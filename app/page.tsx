import { DashboardShell } from "./components/DashboardShell";

export default function Home() {
  const rows = [
    {
      patient: "27699",
      appointmentTime: "07:00",
      provider: "DDSB",
      carrier: "Delta Dental of Colorado",
      plan: "Comprehensive",
      status: "Active",
      lastChecked: "04/27/2025",
    },
    {
      patient: "21514",
      appointmentTime: "07:00",
      provider: "DDS5",
      carrier: "Delta Dental of Washington",
      plan: "Comprehensive",
      status: "Active",
      lastChecked: "Yesterday",
    },
    {
      patient: "18036",
      appointmentTime: "07:00",
      provider: "HG27",
      carrier: "Cigna",
      plan: "Comprehensive",
      status: "Active",
      lastChecked: "04/27/2025",
    },
    {
      patient: "29681",
      appointmentTime: "07:10",
      provider: "HG27",
      carrier: "Cigna",
      plan: "Comprehensive",
      status: "Active",
      lastChecked: "04/27/2025",
    },
    {
      patient: "31561",
      appointmentTime: "07:10",
      provider: "HG39",
      carrier: "Delta Dental of California",
      plan: "Comprehensive",
      status: "Active",
      lastChecked: "04/27/2025",
    },
  ];

  return (
    <DashboardShell title="Eligibility" active="dashboard">
      <section className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                <span className="text-zinc-500 dark:text-zinc-400">Date</span>
                <span>05/02/2025</span>
              </div>
              <div className="inline-flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
                <span className="text-zinc-500 dark:text-zinc-400">Today</span>
                <span className="text-zinc-400">·</span>
                <span>Active appointments</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-72">
                <input
                  placeholder="Search in daily patients…"
                  className="w-full rounded-xl border border-zinc-200 bg-white px-3 py-2 pl-9 text-xs text-zinc-900 outline-none transition focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:focus:border-zinc-600"
                />
                <svg
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M10 18a8 8 0 1 1 0-16 8 8 0 0 1 0 16Z"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                  <path
                    d="M21 21l-5.2-5.2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
              <div className="inline-flex items-center gap-2 text-xs font-medium text-zinc-700 dark:text-zinc-200">
                <span>All Patients</span>
                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
                  {rows.length}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-950/40 dark:text-zinc-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Appointment Time</th>
                    <th className="px-4 py-3 font-medium">Provider</th>
                    <th className="px-4 py-3 font-medium">Carrier</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Last Checked</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {rows.map((row) => (
                    <tr key={row.patient} className="hover:bg-zinc-50 dark:hover:bg-zinc-950/30">
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-50">
                        {row.patient}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">
                        {row.appointmentTime}
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">
                        {row.provider}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-800 dark:text-zinc-100">
                            {row.carrier}
                          </span>
                          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-200">
                            {row.plan}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-700 dark:text-zinc-200">
                        {row.lastChecked}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href="/verify"
                          className="font-medium text-zinc-900 hover:underline dark:text-zinc-100"
                        >
                          View
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
    </DashboardShell>
  );
}
