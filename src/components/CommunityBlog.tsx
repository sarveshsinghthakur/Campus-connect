import { FormEvent, useEffect, useState } from "react";
import { MessageCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type BlogPostRow = Database["public"]["Tables"]["blog_posts"]["Row"];
type BlogCommentRow = Database["public"]["Tables"]["blog_comments"]["Row"];

interface BlogCommentView extends BlogCommentRow {
  author_name: string;
}

interface BlogPostView extends BlogPostRow {
  author_name: string;
  comments: BlogCommentView[];
}

const LOCAL_BLOG_KEY = "community_blog_fallback_v1";

const createId = () => {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const formatDateTime = (value: string) => new Date(value).toLocaleString();

const readLocalPosts = (): BlogPostView[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(LOCAL_BLOG_KEY);

    if (!rawValue) {
      return [];
    }

    const parsed = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed as BlogPostView[];
  } catch {
    return [];
  }
};

const writeLocalPosts = (posts: BlogPostView[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(LOCAL_BLOG_KEY, JSON.stringify(posts));
};

const CommunityBlog = () => {
  const { user, profileName } = useAuth();
  const [posts, setPosts] = useState<BlogPostView[]>([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [activeCommentPostId, setActiveCommentPostId] = useState<string | null>(null);
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});

  const isSchemaMissingError = (error: { code?: string; message?: string } | null) => {
    if (!error) return false;
    if (error.code === "PGRST205") return true;
    return (error.message || "").toLowerCase().includes("could not find the table");
  };

  const publishLocalPost = (title: string, content: string) => {
    if (!user) return;

    const nextPost: BlogPostView = {
      id: createId(),
      title,
      content,
      created_at: new Date().toISOString(),
      author_id: user.id,
      author_name: profileName || "User",
      comments: [],
    };

    setPosts((currentPosts) => {
      const nextPosts = [nextPost, ...currentPosts];
      writeLocalPosts(nextPosts);
      return nextPosts;
    });
  };

  const publishLocalComment = (postId: string, content: string) => {
    if (!user) return;

    const nextComment: BlogCommentView = {
      id: createId(),
      post_id: postId,
      content,
      created_at: new Date().toISOString(),
      author_id: user.id,
      author_name: profileName || "User",
    };

    setPosts((currentPosts) => {
      const nextPosts = currentPosts.map((post) => {
        if (post.id !== postId) {
          return post;
        }

        return {
          ...post,
          comments: [...post.comments, nextComment],
        };
      });

      writeLocalPosts(nextPosts);
      return nextPosts;
    });
  };

  const fetchPosts = async () => {
    if (!user) return;

    setLoading(true);

    const { data: postRows, error: postsError } = await supabase
      .from("blog_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (postsError) {
      if (isSchemaMissingError(postsError)) {
        setSchemaMissing(true);
        setPosts(readLocalPosts());
        setLoading(false);
        return;
      }

      toast({ title: "Error", description: postsError.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const postIds = (postRows || []).map((post) => post.id);
    let commentRows: BlogCommentRow[] = [];

    if (postIds.length > 0) {
      const { data: commentsData, error: commentsError } = await supabase
        .from("blog_comments")
        .select("*")
        .in("post_id", postIds)
        .order("created_at", { ascending: true });

      if (commentsError) {
        if (isSchemaMissingError(commentsError)) {
          setSchemaMissing(true);
          setPosts(readLocalPosts());
          setLoading(false);
          return;
        }

        toast({ title: "Error", description: commentsError.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      commentRows = commentsData || [];
    }

    const profileIds = new Set<string>();
    (postRows || []).forEach((post) => profileIds.add(post.author_id));
    commentRows.forEach((comment) => profileIds.add(comment.author_id));

    const profileIdList = Array.from(profileIds);
    let profileNameMap = new Map<string, string>();

    if (profileIdList.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .in("user_id", profileIdList);

      profileNameMap = new Map((profiles || []).map((profile) => [profile.user_id, profile.name]));
    }

    const commentsByPost = commentRows.reduce<Record<string, BlogCommentView[]>>((acc, comment) => {
      const commentView: BlogCommentView = {
        ...comment,
        author_name: profileNameMap.get(comment.author_id) || "User",
      };

      if (!acc[comment.post_id]) {
        acc[comment.post_id] = [];
      }

      acc[comment.post_id].push(commentView);
      return acc;
    }, {});

    const mappedPosts: BlogPostView[] = (postRows || []).map((post) => ({
      ...post,
      author_name: profileNameMap.get(post.author_id) || "User",
      comments: commentsByPost[post.id] || [],
    }));

    setSchemaMissing(false);
    setPosts(mappedPosts);
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, [user?.id]);

  const handleCreatePost = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) return;

    const title = postTitle.trim();
    const content = postContent.trim();

    if (!title || !content) {
      return;
    }

    if (schemaMissing) {
      publishLocalPost(title, content);
      setPostTitle("");
      setPostContent("");
      toast({ title: "Post published", description: "Saved in local fallback mode." });
      return;
    }

    setPublishing(true);
    const { error } = await supabase.from("blog_posts").insert({
      title,
      content,
      author_id: user.id,
    });

    setPublishing(false);

    if (error) {
      if (isSchemaMissingError(error)) {
        setSchemaMissing(true);
        publishLocalPost(title, content);
        setPostTitle("");
        setPostContent("");
        toast({ title: "Post published", description: "Supabase table missing, saved in local fallback mode." });
        return;
      }

      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setPostTitle("");
    setPostContent("");
    toast({ title: "Post published" });
    fetchPosts();
  };

  const handleCreateComment = async (event: FormEvent<HTMLFormElement>, postId: string) => {
    event.preventDefault();

    if (!user) return;

    const content = (commentDrafts[postId] || "").trim();

    if (!content) {
      return;
    }

    if (schemaMissing) {
      publishLocalComment(postId, content);
      setCommentDrafts((currentDrafts) => ({
        ...currentDrafts,
        [postId]: "",
      }));
      toast({ title: "Comment added", description: "Saved in local fallback mode." });
      return;
    }

    setActiveCommentPostId(postId);
    const { error } = await supabase.from("blog_comments").insert({
      post_id: postId,
      content,
      author_id: user.id,
    });

    setActiveCommentPostId(null);

    if (error) {
      if (isSchemaMissingError(error)) {
        setSchemaMissing(true);
        publishLocalComment(postId, content);
        setCommentDrafts((currentDrafts) => ({
          ...currentDrafts,
          [postId]: "",
        }));
        toast({ title: "Comment added", description: "Supabase table missing, saved in local fallback mode." });
        return;
      }

      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }

    setCommentDrafts((currentDrafts) => ({
      ...currentDrafts,
      [postId]: "",
    }));

    fetchPosts();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Community Blog</CardTitle>
          <p className="text-sm text-muted-foreground">Write posts and comment with all logged-in students and professors.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={handleCreatePost}>
            <Input value={postTitle} onChange={(event) => setPostTitle(event.target.value)} placeholder="Post title" required />
            <Textarea
              value={postContent}
              onChange={(event) => setPostContent(event.target.value)}
              placeholder="Write your post"
              className="min-h-28"
              required
            />
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">Posting as {profileName || "User"}</p>
              <Button type="submit" disabled={publishing}>{publishing ? "Publishing..." : "Publish"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={fetchPosts} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {schemaMissing && (
        <Card>
          <CardContent className="space-y-2 py-6">
            <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">Supabase blog schema missing. Running local fallback mode.</p>
            <p className="text-sm text-muted-foreground">
              Posts and comments are now saved in this browser until your Supabase blog migration is applied.
            </p>
          </CardContent>
        </Card>
      )}

      {loading && <p className="py-6 text-center text-sm text-muted-foreground">Loading posts...</p>}

      {!loading && posts.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">No posts yet. Publish the first one.</CardContent>
        </Card>
      )}

      {!loading && posts.map((post) => (
        <Card key={post.id}>
          <CardHeader>
            <CardTitle className="text-base sm:text-lg">{post.title}</CardTitle>
            <p className="text-sm text-muted-foreground">{post.author_name} | {formatDateTime(post.created_at)}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="whitespace-pre-wrap text-sm leading-6">{post.content}</p>

            <div className="space-y-3 border-t pt-4">
              <p className="inline-flex items-center text-sm font-medium text-muted-foreground">
                <MessageCircle className="mr-2 h-4 w-4" />
                Comments ({post.comments.length})
              </p>

              {post.comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}

              {post.comments.map((comment) => (
                <div key={comment.id} className="rounded-md border bg-muted/30 p-3">
                  <p className="text-sm font-medium">{comment.author_name}</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{comment.content}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(comment.created_at)}</p>
                </div>
              ))}

              <form className="space-y-2" onSubmit={(event) => handleCreateComment(event, post.id)}>
                <Textarea
                  value={commentDrafts[post.id] || ""}
                  onChange={(event) =>
                    setCommentDrafts((currentDrafts) => ({
                      ...currentDrafts,
                      [post.id]: event.target.value,
                    }))
                  }
                  placeholder="Write a comment"
                  className="min-h-20"
                  required
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={activeCommentPostId === post.id}>
                    {activeCommentPostId === post.id ? "Posting..." : "Add comment"}
                  </Button>
                </div>
              </form>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default CommunityBlog;
