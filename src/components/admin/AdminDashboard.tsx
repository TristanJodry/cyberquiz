import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  HelpCircle, 
  Users, 
  TrendingUp, 
  MessageSquareHeart, 
  Settings, 
  LogOut, 
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { AdminUser } from '../../types.ts';
import { AdminOverview } from './AdminOverview.tsx';
import { AdminQuestions } from './AdminQuestions.tsx';
import { AdminParticipations } from './AdminParticipations.tsx';
import { AdminStats } from './AdminStats.tsx';
import { AdminRex } from './AdminRex.tsx';
import { AdminSettings } from './AdminSettings.tsx';

interface AdminDashboardProps {
  token: string;
  admin: AdminUser;
  onLogout: () => void;
  onConfigUpdated?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ token, admin, onLogout, onConfigUpdated }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'questions' | 'participations' | 'statistiques' | 'rex' | 'settings'>('overview');

  const navItems = [
    { id: 'overview', label: 'Tableau de bord', icon: LayoutDashboard },
    { id: 'questions', label: 'Gestion des questions', icon: HelpCircle },
    { id: 'participations', label: 'Participations', icon: Users },
    { id: 'statistiques', label: 'Statistiques & RSE', icon: TrendingUp },
    { id: 'rex', label: 'Retours d’expérience', icon: MessageSquareHeart },
    { id: 'settings', label: 'Paramètres', icon: Settings },
  ] as const;

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-[#070b18] text-slate-100 pb-16">
      
      {/* Barre de navigation d'administration */}
      <div className="bg-[#0c142b]/95 border-b border-cyan-950/60 sticky top-16 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row md:items-center justify-between gap-4 py-3">
          
          {/* Onglets */}
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap transition cursor-pointer ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                      : 'text-slate-400 hover:text-white hover:bg-slate-900/60'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Profil administrateur et Déconnexion */}
          <div className="flex items-center justify-end gap-3 shrink-0">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-slate-200 block">{admin.username}</span>
              <span className="text-[10px] text-cyan-400">Administrateur CyberQuiz</span>
            </div>

            <button
              onClick={onLogout}
              title="Se déconnecter"
              className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950/60 border border-slate-800 hover:border-rose-800 text-slate-400 hover:text-rose-300 transition flex items-center gap-1.5 text-xs font-medium cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Déconnexion</span>
            </button>
          </div>

        </div>
      </div>

      {/* Contenu principal de l'onglet actif */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex-1 w-full">
        {activeTab === 'overview' && (
          <AdminOverview token={token} onNavigateTab={(tab) => setActiveTab(tab as any)} />
        )}
        {activeTab === 'questions' && <AdminQuestions token={token} />}
        {activeTab === 'participations' && <AdminParticipations token={token} />}
        {activeTab === 'statistiques' && <AdminStats token={token} />}
        {activeTab === 'rex' && <AdminRex token={token} />}
        {activeTab === 'settings' && <AdminSettings token={token} onSettingsUpdated={onConfigUpdated} />}
      </main>

    </div>
  );
};
