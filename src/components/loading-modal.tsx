"use client";

type Props = {
  isOpen: boolean;
  message?: string;
};

export function LoadingModal({ isOpen, message = "Working some AI magic, hold on while we process..." }: Props) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex flex-col items-center gap-4">
          {/* Spinner */}
          <div className="relative h-16 w-16">
            <div className="absolute h-16 w-16 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600"></div>
          </div>
          
          {/* Message */}
          <div className="text-center">
            <h3 className="text-lg font-semibold text-slate-900">
              Generating Review
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              {message}
            </p>
          </div>

          {/* Progress indicator */}
          <div className="mt-4 flex gap-1">
            <div className="h-2 w-2 animate-bounce rounded-full bg-blue-600" style={{ animationDelay: "0ms" }}></div>
            <div className="h-2 w-2 animate-bounce rounded-full bg-blue-600" style={{ animationDelay: "150ms" }}></div>
            <div className="h-2 w-2 animate-bounce rounded-full bg-blue-600" style={{ animationDelay: "300ms" }}></div>
          </div>
        </div>
      </div>
    </div>
  );
}

