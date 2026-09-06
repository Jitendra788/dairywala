import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-full flex-col items-center justify-center px-6 py-24">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
        Tony Dairy
      </p>
      <h1 className="mt-2 font-display text-4xl">Page not found</h1>
      <Link href="/" className="mt-6 text-sm font-medium text-primary hover:underline">
        Back to dashboard
      </Link>
    </div>
  );
}
