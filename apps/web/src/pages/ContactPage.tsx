import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn, ArrowLeft } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-screen gradient-mesh flex flex-col">
      {/* Header */}
      <header className="w-full border-b bg-background/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="/ChatGPT Image Jan 19, 2026, 08_14_59 PM.png" 
                alt="MamaLama Logo" 
                className="h-10 w-auto"
              />
            </Link>
            <nav className="flex items-center gap-6">
              <Link 
                to="/about" 
                className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                About Us
              </Link>
              <Link 
                to="/contact" 
                className="text-sm font-medium text-foreground"
              >
                Contact
              </Link>
              <Link to="/login">
                <Button variant="outline" size="sm" className="gap-2">
                  <LogIn className="w-4 h-4" />
                  Log In
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          <Link to="/">
            <Button variant="ghost" size="sm" className="mb-6 gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Home
            </Button>
          </Link>
          <div className="bg-card rounded-lg shadow-lg p-8 space-y-6">
            <h1 className="text-3xl font-bold">Contact Us</h1>
            <div className="space-y-4 text-muted-foreground">
              <p>
                Have questions or need support? We're here to help!
              </p>
              <div className="space-y-2">
                <p><strong>Email:</strong> support@mamalama.com</p>
                <p><strong>Phone:</strong> +972-XXX-XXXX</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
