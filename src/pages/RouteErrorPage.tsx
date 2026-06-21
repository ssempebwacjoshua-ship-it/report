import { isRouteErrorResponse, Link, useLocation, useRouteError } from "react-router-dom";

export function RouteErrorPage() {
  const error = useRouteError();
  const location = useLocation();
  const isLawyerRoute = location.pathname.startsWith("/lawyers");

  let title = "Something went wrong.";
  let description = "Please try again in a moment.";

  if (isRouteErrorResponse(error)) {
    if (error.status === 404) {
      title = "Page not found.";
      description = "The page you tried to open does not exist.";
    } else if (typeof error.data === "string" && error.data.trim()) {
      description = error.data;
    } else if (typeof error.statusText === "string" && error.statusText.trim()) {
      description = error.statusText;
    }
  } else if (error instanceof Error && error.message.trim()) {
    description = error.message;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-[color:var(--sc-primary)]">
          {isLawyerRoute ? "Smart Pages for Lawyers" : "School Connect"}
        </p>
        <h1 className="mt-3 text-2xl font-black text-slate-950">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {isLawyerRoute ? (
            <>
              <Link className="btn btn-primary" to="/lawyers/dashboard">
                Go to lawyer dashboard
              </Link>
              <Link className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" to="/lawyers/documents">
                Go to lawyer documents
              </Link>
            </>
          ) : (
            <>
              <Link className="btn btn-primary" to="/app/dashboard">
                Go to dashboard
              </Link>
              <Link className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50" to="/lawyers/dashboard">
                Go to lawyers
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
