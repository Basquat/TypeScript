import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import Activity from "./pages/Activity";
import AdminAudit from "./pages/AdminAudit";
import AdminHome from "./pages/AdminHome";
import AdminPatients from "./pages/AdminPatients";
import AdminUsers from "./pages/AdminUsers";
import Agenda from "./pages/Agenda";
import Explore from "./pages/Explore";
import Layout from "./pages/Layout";
import Login from "./pages/Login";
import MyAppointments from "./pages/MyAppointments";
import PatientDetail from "./pages/PatientDetail";
import Patients from "./pages/Patients";
import Profile from "./pages/Profile";
import PsychologistPublic from "./pages/PsychologistPublic";
import Requests from "./pages/Requests";
import SessionDetail from "./pages/SessionDetail";
import Today from "./pages/Today";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) return <p className="boot">Carregando…</p>;
  if (!user) return <Login />;

  // As rotas espelham a autorização do back-end; esconder rota aqui é só conforto, não segurança.
  const routes =
    user.perfil === "admin" ? (
      <>
        <Route index element={<AdminHome />} />
        <Route path="usuarios" element={<AdminUsers />} />
        <Route path="pacientes" element={<AdminPatients />} />
        <Route path="auditoria" element={<AdminAudit />} />
      </>
    ) : user.perfil === "cliente" ? (
      <>
        <Route index element={<Explore />} />
        <Route path="psicologos/:id" element={<PsychologistPublic />} />
        <Route path="consultas" element={<MyAppointments />} />
        <Route path="atividade" element={<Activity />} />
      </>
    ) : (
      <>
        <Route index element={<Today />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="pacientes" element={<Patients />} />
        <Route path="pacientes/:id" element={<PatientDetail />} />
        <Route path="sessoes/:id" element={<SessionDetail />} />
        <Route path="solicitacoes" element={<Requests />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="atividade" element={<Activity />} />
      </>
    );

  return (
    <Routes>
      <Route element={<Layout />}>
        {routes}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
