import MainLayout from "@/components/layout/MainLayout";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

export default function ModulePage({ title, description, action = "Adicionar" }: { title: string; description: string; action?: string }) {
  return <MainLayout><div className="space-y-7"><PageHeader title={title} description={description} action={<Button>＋ {action}</Button>} /><Card className="grid min-h-80 place-items-center text-center"><div><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-500/10 text-2xl text-blue-500">◇</div><h2 className="mt-4 text-lg font-semibold">Módulo preparado</h2><p className="mx-auto mt-2 max-w-md text-sm text-[var(--muted)]">A navegação e a base visual estão prontas. Os dados e fluxos deste módulo serão conectados nas próximas etapas.</p></div></Card></div></MainLayout>;
}
