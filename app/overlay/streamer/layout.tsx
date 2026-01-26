export default function StreamerOverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen w-full bg-transparent">
      {children}
    </div>
  );
}
