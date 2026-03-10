import { useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AppTheme, applyTheme, getInitialTheme } from "@/lib/theme";

const ThemeToggle = () => {
  const [theme, setTheme] = useState<AppTheme>(() => getInitialTheme());

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => setTheme((currentTheme) => (currentTheme === "light" ? "dark" : "light"))}
    >
      {theme === "light" ? <MoonStar className="mr-2 h-4 w-4" /> : <SunMedium className="mr-2 h-4 w-4" />}
      {theme === "light" ? "Dark mode" : "Light mode"}
    </Button>
  );
};

export default ThemeToggle;
