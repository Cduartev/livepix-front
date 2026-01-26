export default function UserOverlayLayout({
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
