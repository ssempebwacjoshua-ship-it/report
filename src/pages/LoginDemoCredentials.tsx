export function LoginDemoCredentials({ onFill }: { onFill: () => void }) {
  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-amber-700">
        Local demo credentials
      </p>
      <p className="font-mono text-xs text-amber-800">admin@schoolconnect.test</p>
      <p className="font-mono text-xs text-amber-800">password123</p>
      <button
        type="button"
        onClick={onFill}
        className="mt-2 text-xs font-semibold text-amber-700 underline underline-offset-2 hover:text-amber-900"
      >
        Fill in
      </button>
    </div>
  );
}
