const menuItems = [
  "Dashboard",
  "Agenda",
  "Alunos",
  "Avaliações",
  "Treinos",
  "Relatórios",
  "Configurações",
];

export default function Sidebar() {
  return (
    <aside className="flex min-h-screen w-64 flex-col border-r border-slate-800 bg-slate-900 p-6 text-white">
      <div>
        <h1 className="text-2xl font-bold">Fluxo Pessoal</h1>

        <p className="mt-1 text-sm text-slate-400">
          Gestão para personal trainers
        </p>
      </div>

      <nav className="mt-10 flex flex-col gap-2">
        {menuItems.map((item) => (
          <button
            key={item}
            type="button"
            className="rounded-lg px-4 py-3 text-left text-slate-300 transition hover:bg-slate-800 hover:text-white"
          >
            {item}
          </button>
        ))}
      </nav>
    </aside>
  );
}