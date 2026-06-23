export default function ReplayLayout({ children }: { children: React.ReactNode }) {
  return (
    // Cancel the p-6 lg:p-8 padding from the (app) layout <main>,
    // then lock to viewport height so the chart never scrolls.
    <div className="-m-6 lg:-m-8 h-screen overflow-hidden">
      {children}
    </div>
  );
}
