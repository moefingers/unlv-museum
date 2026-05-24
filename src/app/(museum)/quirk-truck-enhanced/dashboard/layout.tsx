import SideNav from '../ui/primary-nav/sidenav';


export const experimental_ppr = true;

export default function Layout({ children }: { children: React.ReactNode }) {



  return (
    <div className="flex h-screen flex-col md:flex-row md:overflow-hidden">
      <div className="w-full flex-none md:w-64 class-to-identify-nav">
        <SideNav />
      </div>
      <div className="grow md:overflow-y-auto">{children}</div>
    </div>
  );
}
