import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Plus,
  Search,
  Download,
  Upload,
  Pencil,
  Trash2,
  X,
  Check,
  History,
  Archive,
  RefreshCw,
  Truck,
  MessageCircle,
  RotateCcw,
  CalendarCheck,
} from "lucide-react";

const LOTS = [
  { id: 1, montant: 500, duree: 40 },
  { id: 2, montant: 1000, duree: 40 },
  { id: 3, montant: 500, duree: 30 },
  { id: 4, montant: 1000, duree: 30 },
  { id: 5, montant: 500, duree: 20 },
  { id: 6, montant: 1000, duree: 20 },
];

const PACKS = {
  A: [
    { numero: 1, contenu: ["3 patchs draps de lit (6 pcs chacun)", "2 paires d'oreillers orthopédiques"] },
    { numero: 2, contenu: ["1 table de coin", "1 pot de fleur", "1 pot de fleur en verre", "1 patch draps de lit", "1 paire d'oreiller orthopédique"] },
    { numero: 3, contenu: ["2 patchs draps de lit (6 pcs chacun)", "1 table de coin", "1 pot de fleurs"] },
    { numero: 4, contenu: ["1 patch draps de lit", "1 moquette fourrure"] },
    { numero: 5, contenu: ["1 pack draps VIP", "1 table de coin 2 étages"] },
  ],
  B: [
    { numero: 1, contenu: ["4 patchs draps de lit (6 pcs chacun)", "1 ensemble rideau 3 pcs", "1 table de coin simple"] },
    { numero: 2, contenu: ["1 moquette fourrure 2m", "2 patchs draps de lit (6 pcs chacun)", "1 table de coin 2 étages", "1 pot fleurs mini vase + pot fleurs", "1 paire d'oreillers orthopédiques"] },
    { numero: 3, contenu: ["1 patch draps de lit (6 pcs chacun)", "1 table de coin 2 étages", "2 pots de fleurs en vase", "1 paire oreillers orthopédiques", "1 lampe de chevet", "1 moquette fourrure 2m"] },
    { numero: 4, contenu: ["4 patchs draps de lit (6 pcs chacun)", "1 paire oreiller", "1 table de chevet 2 étages", "2 boules lumineuses", "2 mini pots de fleurs"] },
    { numero: 5, contenu: ["3 patchs draps de lit (6 pcs chacun)", "1 ensemble rideau 3 pcs", "1 table de coin 2 étages", "2 pots de fleurs vase"] },
    { numero: 6, contenu: ["1 patch draps de lit (6 pcs)", "1 parure draps VIP", "1 table de coin 2 étages", "1 paire d'oreiller orthopédiques", "3 mini pots de fleurs"] },
    { numero: 7, contenu: ["8 patchs draps de lit (6 pcs chacun)"] },
  ],
};

const PARTICIPANTS_KEY = "tontine-participants";
const COSTS_KEY = "tontine-pack-costs";
const MODES = ["Espèces", "Mobile Money", "Autre"];

const fmt = (n) => new Intl.NumberFormat("fr-FR").format(Math.round(n || 0)) + " F";
const today = () => new Date().toISOString().slice(0, 10);
const lotById = (id) => LOTS.find((l) => l.id === id);

function joursDus(p) {
  const lot = lotById(p.lotId);
  const start = new Date(p.dateInscription);
  const now = new Date(today());
  const diff = Math.floor((now - start) / 86400000) + 1;
  return Math.max(0, Math.min(lot.duree, diff));
}

function stats(p) {
  const lot = lotById(p.lotId);
  const paye = p.versements.reduce((s, v) => s + Number(v.montant), 0);
  const joursPayes = Math.floor(paye / lot.montant);
  const dus = joursDus(p);
  const retard = Math.max(0, dus - joursPayes);
  const joursAvance = Math.max(0, joursPayes - dus);
  const attendu = lot.montant * lot.duree;
  const termine = joursPayes >= lot.duree;
  const payeAujourdhui = p.versements.some((v) => v.date === today());
  const aJour = retard === 0;
  return { lot, paye, joursPayes, dus, retard, joursAvance, attendu, termine, payeAujourdhui, aJour };
}

function coutPack(catalogue, numero, costs) {
  return Number(costs?.[catalogue]?.[numero] || 0);
}

function relanceTexte(p, s) {
  return `Bonjour ${p.nom}, un petit rappel amical : il vous reste ${s.retard} jour(s) de versement en retard pour votre tontine (Lot ${p.lotId} — ${s.lot.montant}F/jour). Merci de régulariser dès que possible. Bien à vous.`;
}

function relanceLink(p, s) {
  const digits = (p.telephone || "").replace(/\D/g, "");
  let phone = digits;
  if (digits.length === 9) phone = "221" + digits;
  else if (digits.startsWith("00221")) phone = digits.slice(2);
  return phone ? `https://wa.me/${phone}?text=${encodeURIComponent(relanceTexte(p, s))}` : null;
}

const emptyCycle = () => ({
  lotId: 1,
  dateInscription: today(),
  catalogue: "A",
  packNumero: 1,
  versements: [],
  packLivre: false,
  dateLivraison: null,
  historique: [],
});

export default function App() {
  const [participants, setParticipants] = useState([]);
  const [costs, setCosts] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [tab, setTab] = useState("apercu");
  const [search, setSearch] = useState("");
  const [filterLot, setFilterLot] = useState("tous");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [versementsFor, setVersementsFor] = useState(null);
  const [cycleFor, setCycleFor] = useState(null);
  const [historiqueFor, setHistoriqueFor] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [pendingImport, setPendingImport] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    // 1. Charger immédiatement les données locales pour un affichage rapide et fiable
    const localP = localStorage.getItem(PARTICIPANTS_KEY);
    const localC = localStorage.getItem(COSTS_KEY);
    let initialP = [];
    let initialC = {};

    try {
      if (localP) initialP = JSON.parse(localP);
      if (localC) initialC = JSON.parse(localC);
    } catch (e) {
      console.error("Erreur de lecture du localStorage:", e);
    }

    if (Array.isArray(initialP) && initialP.length > 0) {
      setParticipants(initialP);
      setCosts(initialC);
    }
    setLoaded(true);

    // 2. Tenter de synchroniser avec l'API Cloud en arrière-plan
    fetch(API_URL)
      .then(res => res.json())
      .then(data => {
        // Si l'API cloud est configurée et renvoie des données valides
        if (data && data.configured !== false && Array.isArray(data.participants)) {
          if (data.participants.length > 0) {
            setParticipants(data.participants);
            setCosts(data.costs || {});
            localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(data.participants));
            localStorage.setItem(COSTS_KEY, JSON.stringify(data.costs || {}));
          } else if (initialP.length > 0) {
            // Si la base cloud est vide mais qu'on a des données locales, on envoie les données locales vers le cloud
            syncAPI(initialP, initialC);
          }
        }
      })
      .catch(err => {
        console.warn("API non joignable, conservation des données locales:", err);
      });
  }, []);

  function syncAPI(p, c) {
    // Enregistrement synchrone dans localStorage
    localStorage.setItem(PARTICIPANTS_KEY, JSON.stringify(p));
    localStorage.setItem(COSTS_KEY, JSON.stringify(c));

    // Envoi en arrière-plan vers l'API
    fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participants: p, costs: c })
    }).catch(e => console.error("Erreur de synchronisation API", e));
  }


  function persist(next) {
    setParticipants(next);
    syncAPI(next, costs);
  }

  function persistCosts(next) {
    setCosts(next);
    syncAPI(participants, next);
  }

  function saveParticipant(data) {
    const { premierVersement, ...restData } = data;
    if (editing) {
      persist(participants.map((p) => (p.id === editing.id ? { ...p, ...restData } : p)));
    } else {
      const newParticipant = { id: Date.now().toString(), ...emptyCycle(), nom: restData.nom, telephone: restData.telephone, ...restData };
      if (premierVersement && Number(premierVersement) > 0) {
        newParticipant.versements = [{ date: restData.dateInscription, montant: Number(premierVersement), mode: "Espèces" }];
      }
      persist([newParticipant, ...participants]);
    }
    setFormOpen(false);
    setEditing(null);
  }

  function deleteParticipant(id) {
    persist(participants.filter((p) => p.id !== id));
    setConfirmDelete(null);
  }

  function addVersement(participantId, versement) {
    persist(participants.map((p) => (p.id === participantId ? { ...p, versements: [...p.versements, versement] } : p)));
  }

  function removeVersement(participantId, index) {
    persist(participants.map((p) => (p.id === participantId ? { ...p, versements: p.versements.filter((_, i) => i !== index) } : p)));
  }

  function toggleAujourdhui(p, s) {
    const todayVersIdx = p.versements.findLastIndex((v) => v.date === today());
    if (s.payeAujourdhui && todayVersIdx !== -1) {
      removeVersement(p.id, todayVersIdx);
    } else {
      addVersement(p.id, { date: today(), montant: s.lot.montant, mode: "Espèces" });
    }
  }

  function toggleLivraison(p) {
    persist(
      participants.map((x) =>
        x.id === p.id ? { ...x, packLivre: !x.packLivre, dateLivraison: !x.packLivre ? today() : null } : x
      )
    );
  }

  function startNewCycle(p, cycleData) {
    const s = stats(p);
    const archived = {
      lotId: p.lotId,
      dateInscription: p.dateInscription,
      dateFin: today(),
      catalogue: p.catalogue,
      packNumero: p.packNumero,
      montantCollecte: s.paye,
      packLivre: p.packLivre,
      dateLivraison: p.dateLivraison,
    };
    persist(
      participants.map((x) =>
        x.id === p.id
          ? {
            ...x,
            historique: [...(x.historique || []), archived],
            lotId: cycleData.lotId,
            dateInscription: cycleData.dateInscription,
            catalogue: cycleData.catalogue,
            packNumero: cycleData.packNumero,
            versements: [],
            packLivre: false,
            dateLivraison: null,
          }
          : x
      )
    );
    setCycleFor(null);
  }

  async function resetAll() {
    await persist([]);
    await persistCosts({});
    setConfirmDelete(null);
  }

  function updateCost(cat, num, value) {
    const next = { ...costs, [cat]: { ...(costs[cat] || {}), [num]: value } };
    persistCosts(next);
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify({ participants, costs }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tontine-sauvegarde-${today()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        setPendingImport(data);
      } catch (err) {
        console.error("Fichier invalide", err);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  function confirmImport() {
    if (pendingImport?.participants) persist(pendingImport.participants);
    if (pendingImport?.costs) persistCosts(pendingImport.costs);
    setPendingImport(null);
  }

  function exportCSV() {
    const rows = [
      ["Nom", "Téléphone", "Lot", "Jours payés", "Montant payé", "Montant attendu", "Retard (jours)", "Catalogue", "Pack visé", "Statut", "Pack livré", "Cycles précédents"],
    ];
    participants.forEach((p) => {
      const s = stats(p);
      rows.push([
        p.nom,
        p.telephone,
        `Lot ${p.lotId} (${lotById(p.lotId).montant}F/j x${lotById(p.lotId).duree}j)`,
        s.joursPayes,
        s.paye,
        s.attendu,
        s.retard,
        p.catalogue,
        p.packNumero,
        s.termine ? "Terminé" : s.retard > 0 ? "En retard" : "Actif",
        p.packLivre ? "Oui" : "Non",
        (p.historique || []).length,
      ]);
    });
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tontine-export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filtered = useMemo(() => {
    return participants.filter((p) => {
      const matchSearch = p.nom.toLowerCase().includes(search.toLowerCase());
      const matchLot = filterLot === "tous" || p.lotId === Number(filterLot);
      return matchSearch && matchLot;
    });
  }, [participants, search, filterLot]);

  const totals = useMemo(() => {
    let collecte = 0, attendu = 0, enRetard = 0, termines = 0, coutTotal = 0, aLivrer = 0;
    const parLot = {};
    LOTS.forEach((l) => (parLot[l.id] = 0));
    participants.forEach((p) => {
      const s = stats(p);
      collecte += s.paye;
      attendu += s.attendu;
      coutTotal += coutPack(p.catalogue, p.packNumero, costs);
      if (s.retard > 0 && !s.termine) enRetard++;
      if (s.termine) {
        termines++;
        if (!p.packLivre) aLivrer++;
      }
      parLot[p.lotId]++;
    });
    return { collecte, attendu, enRetard, termines, parLot, coutTotal, aLivrer, marge: attendu - coutTotal };
  }, [participants, costs]);

  if (!loaded) {
    return (
      <div style={{ fontFamily: "'IBM Plex Sans', sans-serif" }} className="flex items-center justify-center h-full min-h-screen text-slate-500">
        Chargement…
      </div>
    );
  }

  return (
    <div className="app-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .app-root { display: flex; min-height: 100vh; background: #F5F3ED; font-family: 'IBM Plex Sans', sans-serif; }
        .app-sidebar { width: 230px; background: #1F2A44; display: flex; flex-direction: column; flex-shrink: 0; }
        .app-main { flex: 1; padding: 32px 40px; overflow-x: auto; padding-bottom: 80px; }
        .nav-item { display:flex; align-items:center; gap:10px; padding:10px 16px; border-radius:6px; cursor:pointer; color:#C9CDDA; font-size:14px; transition:background .15s; }
        .nav-item:hover { background:#2A3550; }
        .nav-item.active { background:#C08829; color:#1F2A44; font-weight:600; }
        .btn { display:inline-flex; align-items:center; gap:6px; padding:9px 14px; border-radius:8px; font-size:13px; font-weight:500; cursor:pointer; border:none; white-space:nowrap; touch-action: manipulation; transition: transform 0.1s; }
        .btn:active { transform: scale(0.98); }
        .btn-gold { background:#C08829; color:#1F2A44; }
        .btn-gold:hover { background:#A8751F; }
        .btn-ghost { background:transparent; border:1px solid #DAD5C7; color:#445067; }
        .btn-ghost:hover { background:#EFEDE6; }
        .btn-danger { background:#9C4221; color:#fff; }
        .btn-green { background:#3F6B4E; color:#fff; }
        table { border-collapse:collapse; width:100%; white-space: nowrap; }
        th { text-align:left; font-size:12px; color:#7A8299; font-weight:500; padding:8px 12px; border-bottom:1px solid #DAD5C7; }
        td { padding:10px 12px; border-bottom:1px solid #EDEAE0; font-size:14px; color:#1F2A44; vertical-align:middle; }
        input, select { font-family:'IBM Plex Sans', sans-serif; padding:10px 12px; border:1px solid #DAD5C7; border-radius:8px; font-size:14px; width:100%; -webkit-appearance: none; }
        input:focus, select:focus { outline:2px solid #C08829; outline-offset:1px; }
        .badge { display:inline-block; padding:3px 9px; border-radius:20px; font-size:11px; font-weight:600; }
        
        .finance-hero { background: linear-gradient(145deg, #1F2A44 0%, #111827 100%); color: white; border-radius: 16px; padding: 28px; margin-bottom: 30px; box-shadow: 0 12px 35px rgba(31, 42, 68, 0.2); }
        .finance-main { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 24px; margin-bottom: 24px; }
        .finance-main-title { font-size: 13px; color: #9CA3AF; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; font-weight: 500; }
        .finance-main-value { font-family: 'Fraunces', serif; font-size: 46px; font-weight: 600; line-height: 1; color: #fff; text-shadow: 0 2px 10px rgba(0,0,0,0.3); }
        .finance-main-pct { font-family: 'Fraunces', serif; font-size: 36px; color: #E5A93D; font-weight: 600; text-shadow: 0 2px 10px rgba(229,169,61,0.2); }
        
        .finance-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
        .finance-card { background: rgba(255,255,255,0.04); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); transition: transform 0.2s; }
        .finance-card:hover { transform: translateY(-2px); background: rgba(255,255,255,0.06); }
        .finance-card-title { font-size: 12px; color: #9CA3AF; margin-bottom: 8px; font-weight: 500; }
        .finance-card-value { font-family: 'Fraunces', serif; font-size: 22px; font-weight: 600; color: #F3F4F6; }
        .finance-card-value.highlight { color: #E5A93D; }

        .mobile-only { display: none !important; }
        .desktop-only { display: block; }
        table.desktop-only { display: table; }

        @media (max-width: 768px) {
          .mobile-only { display: flex !important; }
          .desktop-only { display: none !important; }
          
          .app-root { flex-direction: column; }
          .app-sidebar {
            width: 100%;
            padding: 6px 8px;
            flex-direction: row;
            justify-content: space-around;
            position: fixed;
            bottom: 0;
            left: 0;
            z-index: 100;
            height: auto;
            padding-bottom: calc(8px + env(safe-area-inset-bottom));
            background: #111827;
            border-top: 1px solid #2A3550;
            box-shadow: 0 -4px 15px rgba(0,0,0,0.25);
          }
          .logo { display: none; }
          .app-sidebar > nav { flex-direction: row !important; width: 100%; justify-content: space-around; padding: 0 !important; }
          .app-sidebar .nav-item { flex-direction: column; gap: 3px; padding: 8px 4px; font-size: 10px; text-align: center; border-radius: 8px; flex: 1; justify-content: center; }
          .app-sidebar .nav-item.active { background: #C08829; color: #1F2A44; }
          .sidebar-footer { display: none !important; }
          .app-main { padding: 16px 14px 110px 14px; }
          
          .header-actions { flex-direction: row; width: 100%; gap: 8px; margin-top: 10px; }
          .header-actions button { flex: 1; justify-content: center; padding: 12px; }
          .search-bar { width: 100% !important; max-width: none !important; }
          .stats-container { gap: 10px !important; grid-template-columns: repeat(2, 1fr) !important; display: grid !important; }
          .stat-divider { display: none !important; }
          .stat-box { background: #fff; padding: 14px; border-radius: 10px; border: 1px solid #edeae0; text-align: center; }
          .finance-hero { padding: 18px; border-radius: 14px; }
          .finance-main { flex-direction: row; justify-content: space-between; align-items: center; gap: 10px; padding-bottom: 16px; margin-bottom: 16px; }
          .finance-main-value { font-size: 32px; }
          .finance-main-pct { font-size: 28px; }
          .finance-grid { grid-template-columns: 1fr; gap: 10px; }

          /* Mobile Cards */
          .mobile-card-list { display: flex; flex-direction: column; gap: 12px; margin-top: 10px; }
          .mobile-card {
            background: #FFFFFF;
            border-radius: 12px;
            padding: 16px;
            border: 1px solid #EDEAE0;
            box-shadow: 0 2px 8px rgba(0,0,0,0.03);
            display: flex;
            flex-direction: column;
            gap: 12px;
          }
          .mobile-card-header { display: flex; justify-content: space-between; align-items: flex-start; }
          .mobile-card-title { font-weight: 600; font-size: 16px; color: #1F2A44; }
          .mobile-card-subtitle { font-size: 12px; color: #7A8299; margin-top: 2px; }
          .mobile-card-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; border-top: 1px solid #F3F1EB; padding-top: 10px; }
          .mobile-card-actions button { flex: 1; min-width: 44px; justify-content: center; padding: 8px 10px; font-size: 12px; }

          /* Bottom Sheet Modals on Mobile */
          .modal-overlay-custom {
            position: fixed; inset: 0; background: rgba(17, 24, 39, 0.6);
            backdrop-filter: blur(4px); display: flex; align-items: flex-end;
            justify-content: center; z-index: 150; padding: 0;
          }
          .modal-box-custom {
            background: #fff; border-radius: 20px 20px 0 0; width: 100%;
            max-width: 100%; max-height: 88vh; overflow-y: auto;
            padding: 16px 16px calc(24px + env(safe-area-inset-bottom)) 16px;
            animation: mobileSlideUp 0.22s ease-out;
          }
          @keyframes mobileSlideUp {
            from { transform: translateY(100%); }
            to { transform: translateY(0); }
          }
          .modal-drag-indicator {
            width: 38px; height: 5px; background: #DAD5C7; border-radius: 3px; margin: 0 auto 12px auto;
          }
        }
      `}</style>


      <aside className="app-sidebar">
        <div className="logo" style={{ padding: "22px 20px 18px", fontFamily: "'Fraunces', serif", fontSize: 21, fontWeight: 600, color: "#fff" }}>
          Tontine
        </div>
        <nav style={{ display: "flex", flexDirection: "column", gap: 2, padding: "0 10px" }}>
          <div className={`nav-item ${tab === "apercu" ? "active" : ""}`} onClick={() => setTab("apercu")}>
            <LayoutDashboard size={17} /> Aperçu
          </div>
          <div className={`nav-item ${tab === "collecte" ? "active" : ""}`} onClick={() => setTab("collecte")}>
            <CalendarCheck size={17} /> Collecte
          </div>
          <div className={`nav-item ${tab === "participants" ? "active" : ""}`} onClick={() => setTab("participants")}>
            <Users size={17} /> Membres
          </div>
          <div className={`nav-item ${tab === "livraisons" ? "active" : ""}`} onClick={() => setTab("livraisons")}>
            <Truck size={17} /> Colis {totals.aLivrer > 0 && <span style={{ background: "#9C4221", color: "#fff", borderRadius: 10, fontSize: 11, padding: "1px 7px", marginLeft: "auto" }}>{totals.aLivrer}</span>}
          </div>
          <div className={`nav-item ${tab === "catalogue" ? "active" : ""}`} onClick={() => setTab("catalogue")}>
            <Package size={17} /> Packs
          </div>
        </nav>
        <div className="sidebar-footer" style={{ marginTop: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 2 }}>
          <div className="nav-item" style={{ fontSize: 12, color: "#8993AC" }} onClick={exportBackup}>
            <Download size={14} /> Sauvegarder
          </div>
          <div className="nav-item" style={{ fontSize: 12, color: "#8993AC" }} onClick={() => fileInputRef.current?.click()}>
            <Upload size={14} /> Restaurer
          </div>
          <input ref={fileInputRef} type="file" accept="application/json" style={{ display: "none" }} onChange={handleImportFile} />
          <div className="nav-item" style={{ fontSize: 12, color: "#8993AC" }} onClick={() => setConfirmDelete("reset")}>
            <RefreshCw size={14} /> Réinitialiser
          </div>
        </div>
      </aside>

      <main className="app-main">
        {tab === "apercu" && <Apercu totals={totals} participants={participants} costs={costs} />}

        {tab === "collecte" && <CollecteDuJour participants={participants} onToggle={toggleAujourdhui} />}

        {tab === "participants" && (
          <Participants
            participants={filtered}
            search={search}
            setSearch={setSearch}
            filterLot={filterLot}
            setFilterLot={setFilterLot}
            onAdd={() => { setEditing(null); setFormOpen(true); }}
            onEdit={(p) => { setEditing(p); setFormOpen(true); }}
            onDelete={(p) => setConfirmDelete(p)}
            onVersements={(p) => setVersementsFor(p)}
            onCycle={(p) => setCycleFor(p)}
            onHistorique={(p) => setHistoriqueFor(p)}
            onLivraison={toggleLivraison}
            onExport={exportCSV}
          />
        )}

        {tab === "livraisons" && <Livraisons participants={participants} onToggle={toggleLivraison} />}

        {tab === "catalogue" && <Catalogue participants={participants} costs={costs} onUpdateCost={updateCost} />}
      </main>

      {formOpen && (
        <ParticipantForm
          initial={editing}
          onCancel={() => { setFormOpen(false); setEditing(null); }}
          onSave={saveParticipant}
        />
      )}

      {versementsFor && (
        <VersementsModal
          participant={participants.find((p) => p.id === versementsFor.id) || versementsFor}
          onClose={() => setVersementsFor(null)}
          onAdd={(v) => addVersement(versementsFor.id, v)}
          onRemove={(i) => removeVersement(versementsFor.id, i)}
        />
      )}

      {cycleFor && (
        <NewCycleForm participant={cycleFor} onCancel={() => setCycleFor(null)} onSave={(data) => startNewCycle(cycleFor, data)} />
      )}

      {historiqueFor && (
        <HistoriqueModal participant={historiqueFor} onClose={() => setHistoriqueFor(null)} />
      )}

      {confirmDelete && (
        <ConfirmModal
          message={confirmDelete === "reset" ? "Supprimer toutes les données de la tontine (participants et coûts) ? Cette action est irréversible." : `Supprimer le participant "${confirmDelete.nom}" ?`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => (confirmDelete === "reset" ? resetAll() : deleteParticipant(confirmDelete.id))}
        />
      )}

      {pendingImport && (
        <ConfirmModal
          message="Restaurer cette sauvegarde va remplacer toutes les données actuelles. Continuer ?"
          onCancel={() => setPendingImport(null)}
          onConfirm={confirmImport}
        />
      )}
    </div>
  );
}

function Apercu({ totals, participants }) {
  const taux = totals.attendu > 0 ? (totals.collecte / totals.attendu) * 100 : 0;
  const maxLot = Math.max(1, ...Object.values(totals.parLot));
  const enRetardList = participants
    .map((p) => ({ p, s: stats(p) }))
    .filter(({ s }) => s.retard > 0 && !s.termine)
    .sort((a, b) => b.s.retard - a.s.retard)
    .slice(0, 10);
  const [copied, setCopied] = useState(null);

  function relancer(p, s) {
    const link = relanceLink(p, s);
    if (link) {
      window.open(link, "_blank");
    } else {
      navigator.clipboard?.writeText(relanceTexte(p, s));
      setCopied(p.id);
      setTimeout(() => setCopied(null), 1500);
    }
  }

  return (
    <div>
      <h1 style={styles.h1}>Aperçu</h1>

      <div className="finance-hero">
        <div className="finance-main">
          <div>
            <div className="finance-main-title">Total Collecté</div>
            <div className="finance-main-value">{fmt(totals.collecte)}</div>
          </div>
          <div className="finance-main-pct">{taux.toFixed(1)}%</div>
        </div>

        <div className="finance-grid">
          <div className="finance-card">
            <div className="finance-card-title">Montant Global Attendu</div>
            <div className="finance-card-value">{fmt(totals.attendu)}</div>
          </div>
          <div className="finance-card">
            <div className="finance-card-title">Coût Total des Packs</div>
            <div className="finance-card-value">{fmt(totals.coutTotal)}</div>
          </div>
          <div className="finance-card" style={{ background: "rgba(229,169,61,0.08)", borderColor: "rgba(229,169,61,0.2)" }}>
            <div className="finance-card-title" style={{ color: "#FDE68A" }}>Marge Brute Estimée</div>
            <div className="finance-card-value highlight">{fmt(totals.marge)}</div>
          </div>
        </div>
      </div>

      <div className="stats-container" style={styles.statsRow}>
        <div className="stat-box" style={styles.statBlock}>
          <div style={styles.statNum}>{participants.length}</div>
          <div style={styles.statLabel}>Participants</div>
        </div>
        <div className="stat-divider" style={styles.divider} />
        <div className="stat-box" style={styles.statBlock}>
          <div style={{ ...styles.statNum, color: "#9C4221" }}>{totals.enRetard}</div>
          <div style={styles.statLabel}>En retard</div>
        </div>
        <div className="stat-divider" style={styles.divider} />
        <div className="stat-box" style={styles.statBlock}>
          <div style={{ ...styles.statNum, color: "#3F6B4E" }}>{totals.termines}</div>
          <div style={styles.statLabel}>Terminés</div>
        </div>
        <div className="stat-divider" style={styles.divider} />
        <div className="stat-box" style={styles.statBlock}>
          <div style={{ ...styles.statNum, color: "#C08829" }}>{totals.aLivrer}</div>
          <div style={styles.statLabel}>À livrer</div>
        </div>
      </div>

      <h2 style={styles.h2}>Répartition par lot</h2>
      <div style={{ marginBottom: 32 }}>
        {LOTS.map((l) => (
          <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 160, fontSize: 13, color: "#445067" }}>Lot {l.id} — {l.montant}F × {l.duree}j</div>
            <div style={{ flex: 1, background: "#EDEAE0", borderRadius: 4, height: 10, overflow: "hidden" }}>
              <div style={{ width: `${(totals.parLot[l.id] / maxLot) * 100}%`, background: "#C08829", height: "100%" }} />
            </div>
            <div style={{ width: 24, fontSize: 13, color: "#1F2A44", textAlign: "right" }}>{totals.parLot[l.id]}</div>
          </div>
        ))}
      </div>

      {enRetardList.length > 0 && (
        <>
          <h2 style={styles.h2}>Participants en retard</h2>
          <table className="desktop-only">
            <thead>
              <tr>
                <th>Nom</th>
                <th>Lot</th>
                <th>Jours payés / dus</th>
                <th>Retard</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {enRetardList.map(({ p, s }) => (
                <tr key={p.id}>
                  <td>{p.nom}</td>
                  <td>Lot {p.lotId}</td>
                  <td>{s.joursPayes} / {s.dus}</td>
                  <td style={{ color: "#9C4221", fontWeight: 600 }}>{s.retard} jour(s)</td>
                  <td>
                    <button className="btn btn-ghost" onClick={() => relancer(p, s)}>
                      <MessageCircle size={13} /> {copied === p.id ? "Copié !" : "Relancer"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mobile-only mobile-card-list">
            {enRetardList.map(({ p, s }) => (
              <div key={p.id} className="mobile-card">
                <div className="mobile-card-header">
                  <div>
                    <div className="mobile-card-title">{p.nom}</div>
                    <div className="mobile-card-subtitle">Lot {p.lotId} • {s.joursPayes}/{s.dus} jours payés</div>
                  </div>
                  <span className="badge" style={{ background: "#FDE8E8", color: "#9C4221" }}>{s.retard}j retard</span>
                </div>
                <button className="btn btn-gold" style={{ width: "100%", justifyContent: "center" }} onClick={() => relancer(p, s)}>
                  <MessageCircle size={15} /> {copied === p.id ? "Copié !" : "Relancer sur WhatsApp"}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function CollecteDuJour({ participants, onToggle }) {
  const actifs = participants
    .map((p) => ({ p, s: stats(p) }))
    .filter(({ s }) => !s.termine)
    .sort((a, b) => b.s.retard - a.s.retard || a.p.nom.localeCompare(b.p.nom));
  const payes = actifs.filter(({ s }) => s.aJour).length;
  const attenduAujourdhui = actifs.reduce((sum, { s }) => sum + s.lot.montant, 0);
  const collecteAujourdhui = actifs.reduce((sum, { p }) =>
    sum + p.versements.filter(v => v.date === today()).reduce((acc, v) => acc + Number(v.montant), 0), 0);

  return (
    <div>
      <h1 style={styles.h1}>Collecte du jour</h1>
      <div style={styles.ledger}>
        <div>
          <div style={styles.ledgerBig}>{payes} / {actifs.length}</div>
          <div style={styles.ledgerLabel}>participants sont à jour — {fmt(collecteAujourdhui)} collectés aujourd'hui (Objectif journalier: {fmt(attenduAujourdhui)})</div>
        </div>
      </div>

      {actifs.length === 0 && <p style={{ color: "#8993AC", fontSize: 14 }}>Aucun cycle actif en cours.</p>}

      <div className="table-container">
        <table className="desktop-only">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Lot</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {actifs.map(({ p, s }) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 500 }}>{p.nom}</td>
                <td>Lot {p.lotId}</td>
                <td>
                  {s.retard > 0
                    ? <div style={{ color: "#9C4221", fontWeight: 600 }}>{s.retard} jour(s) de retard</div>
                    : s.joursAvance > 0
                      ? <div style={{ color: "#C08829", fontWeight: 600 }}>En avance (+{s.joursAvance}j)</div>
                      : <div style={{ color: "#3F6B4E", fontWeight: 600 }}>À jour</div>
                  }
                </td>
                <td>
                  <button className={`btn ${s.payeAujourdhui ? "btn-green" : s.joursAvance > 0 ? "btn-ghost" : "btn-gold"}`} onClick={() => onToggle(p, s)}>
                    {s.payeAujourdhui ? <><Check size={14} /> Payé aujourd'hui</> : s.joursAvance > 0 ? <><Plus size={14} /> Ajouter paiement</> : "Marquer payé"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mobile-only mobile-card-list">
          {actifs.map(({ p, s }) => (
            <div key={p.id} className="mobile-card">
              <div className="mobile-card-header">
                <div>
                  <div className="mobile-card-title">{p.nom}</div>
                  <div className="mobile-card-subtitle">Lot {p.lotId} ({s.lot.montant}F/jour)</div>
                </div>
                {s.retard > 0 ? (
                  <span className="badge" style={{ background: "#FDE8E8", color: "#9C4221" }}>{s.retard}j retard</span>
                ) : s.joursAvance > 0 ? (
                  <span className="badge" style={{ background: "#FEF3C7", color: "#C08829" }}>+{s.joursAvance}j avance</span>
                ) : (
                  <span className="badge" style={{ background: "#E8F5E9", color: "#3F6B4E" }}>À jour</span>
                )}
              </div>
              <button className={`btn ${s.payeAujourdhui ? "btn-green" : s.joursAvance > 0 ? "btn-ghost" : "btn-gold"}`} style={{ width: "100%", justifyContent: "center" }} onClick={() => onToggle(p, s)}>
                {s.payeAujourdhui ? <><Check size={16} /> Payé aujourd'hui</> : s.joursAvance > 0 ? <><Plus size={16} /> Versement supplémentaire</> : "Marquer payé (" + s.lot.montant + "F)"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Livraisons({ participants, onToggle }) {
  const termines = participants.map((p) => ({ p, s: stats(p) })).filter(({ s }) => s.termine);
  const enAttente = termines.filter(({ p }) => !p.packLivre);
  const livres = termines.filter(({ p }) => p.packLivre);

  return (
    <div>
      <h1 style={styles.h1}>Livraisons de packs</h1>
      <h2 style={styles.h2}>En attente ({enAttente.length})</h2>
      <table className="desktop-only" style={{ marginBottom: 32 }}>
        <thead><tr><th>Nom</th><th>Pack visé</th><th>Cycle terminé le</th><th></th></tr></thead>
        <tbody>
          {enAttente.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#8993AC", padding: 16 }}>Rien en attente.</td></tr>}
          {enAttente.map(({ p }) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 500 }}>{p.nom}</td>
              <td>{p.catalogue} — Pack {p.packNumero}</td>
              <td>{p.versements[p.versements.length - 1]?.date || "—"}</td>
              <td><button className="btn btn-gold" onClick={() => onToggle(p)}><Truck size={14} /> Marquer livré</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mobile-only mobile-card-list" style={{ marginBottom: 24 }}>
        {enAttente.length === 0 && <p style={{ color: "#8993AC", fontSize: 13 }}>Rien en attente.</p>}
        {enAttente.map(({ p }) => (
          <div key={p.id} className="mobile-card">
            <div className="mobile-card-header">
              <div>
                <div className="mobile-card-title">{p.nom}</div>
                <div className="mobile-card-subtitle">{p.catalogue} — Pack {p.packNumero}</div>
              </div>
              <span className="badge" style={{ background: "#FEF3C7", color: "#C08829" }}>À livrer</span>
            </div>
            <button className="btn btn-gold" style={{ width: "100%", justifyContent: "center" }} onClick={() => onToggle(p)}>
              <Truck size={16} /> Marquer livré
            </button>
          </div>
        ))}
      </div>

      <h2 style={styles.h2}>Livrés ({livres.length})</h2>
      <table className="desktop-only">
        <thead><tr><th>Nom</th><th>Pack</th><th>Livré le</th><th></th></tr></thead>
        <tbody>
          {livres.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#8993AC", padding: 16 }}>Aucune livraison pour l'instant.</td></tr>}
          {livres.map(({ p }) => (
            <tr key={p.id}>
              <td style={{ fontWeight: 500 }}>{p.nom}</td>
              <td>{p.catalogue} — Pack {p.packNumero}</td>
              <td>{p.dateLivraison}</td>
              <td><button className="btn btn-ghost" onClick={() => onToggle(p)}>Annuler</button></td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mobile-only mobile-card-list">
        {livres.length === 0 && <p style={{ color: "#8993AC", fontSize: 13 }}>Aucune livraison pour l'instant.</p>}
        {livres.map(({ p }) => (
          <div key={p.id} className="mobile-card">
            <div className="mobile-card-header">
              <div>
                <div className="mobile-card-title">{p.nom}</div>
                <div className="mobile-card-subtitle">{p.catalogue} — Pack {p.packNumero} (Livré le {p.dateLivraison})</div>
              </div>
              <span className="badge" style={{ background: "#E8F5E9", color: "#3F6B4E" }}>Livré</span>
            </div>
            <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => onToggle(p)}>
              Annuler livraison
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Participants({ participants, search, setSearch, filterLot, setFilterLot, onAdd, onEdit, onDelete, onVersements, onCycle, onHistorique, onLivraison, onExport }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 10 }}>
        <h1 style={styles.h1}>Participants</h1>
        <div className="header-actions" style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-ghost" onClick={onExport}><Download size={14} /> Exporter</button>
          <button className="btn btn-gold" onClick={onAdd}><Plus size={14} /> Ajouter</button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div className="search-bar" style={{ position: "relative", flex: 1, maxWidth: 280 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 10, color: "#8993AC" }} />
          <input style={{ paddingLeft: 32 }} placeholder="Rechercher un nom…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select style={{ maxWidth: 200 }} value={filterLot} onChange={(e) => setFilterLot(e.target.value)}>
          <option value="tous">Tous les lots</option>
          {LOTS.map((l) => <option key={l.id} value={l.id}>Lot {l.id} — {l.montant}F × {l.duree}j</option>)}
        </select>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="desktop-only">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Téléphone</th>
              <th>Lot</th>
              <th>Progression</th>
              <th>Pack visé</th>
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {participants.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "#8993AC", padding: 24 }}>Aucun participant pour l'instant.</td></tr>
            )}
            {participants.map((p) => {
              const s = stats(p);
              const pct = Math.min(100, (s.joursPayes / s.lot.duree) * 100);
              const statut = s.termine ? "Terminé" : s.retard > 0 ? "En retard" : "Actif";
              const statutColor = s.termine ? "#3F6B4E" : s.retard > 0 ? "#9C4221" : "#445067";
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>
                    {p.nom}
                    {(p.historique || []).length > 0 && (
                      <span className="badge" style={{ background: "#EFEDE6", color: "#7A8299", marginLeft: 6, cursor: "pointer" }} onClick={() => onHistorique(p)}>
                        {p.historique.length} cycle(s) précédent(s)
                      </span>
                    )}
                  </td>
                  <td>{p.telephone}</td>
                  <td>Lot {p.lotId}</td>
                  <td style={{ minWidth: 150 }}>
                    <div style={{ fontSize: 12, marginBottom: 3, color: "#445067" }}>{s.joursPayes}/{s.lot.duree}j — {fmt(s.paye)}</div>
                    <div style={{ background: "#EDEAE0", height: 6, borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, background: s.retard > 0 ? "#9C4221" : "#C08829", height: "100%" }} />
                    </div>
                  </td>
                  <td>{p.catalogue} — Pack {p.packNumero}</td>
                  <td>
                    <div style={{ color: statutColor, fontWeight: 600 }}>{statut}</div>
                    {s.termine && (
                      <div style={{ fontSize: 11, color: p.packLivre ? "#3F6B4E" : "#C08829" }}>{p.packLivre ? "Pack livré" : "Pack en attente"}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      <button className="btn btn-ghost" style={{ padding: 6 }} title="Versements" onClick={() => onVersements(p)}><History size={14} /></button>
                      {s.termine && !p.packLivre && (
                        <button className="btn btn-ghost" style={{ padding: 6 }} title="Marquer livré" onClick={() => onLivraison(p)}><Truck size={14} /></button>
                      )}
                      {s.termine && (
                        <button className="btn btn-ghost" style={{ padding: 6 }} title="Nouveau cycle" onClick={() => onCycle(p)}><RotateCcw size={14} /></button>
                      )}
                      <button className="btn btn-ghost" style={{ padding: 6 }} title="Modifier" onClick={() => onEdit(p)}><Pencil size={14} /></button>
                      <button className="btn btn-ghost" style={{ padding: 6 }} title="Supprimer" onClick={() => onDelete(p)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div className="mobile-only mobile-card-list">
          {participants.length === 0 && (
            <p style={{ textAlign: "center", color: "#8993AC", padding: 24 }}>Aucun participant pour l'instant.</p>
          )}
          {participants.map((p) => {
            const s = stats(p);
            const pct = Math.min(100, (s.joursPayes / s.lot.duree) * 100);
            const statut = s.termine ? "Terminé" : s.retard > 0 ? "En retard" : "Actif";
            const statutColor = s.termine ? "#3F6B4E" : s.retard > 0 ? "#9C4221" : "#445067";
            return (
              <div key={p.id} className="mobile-card">
                <div className="mobile-card-header">
                  <div>
                    <div className="mobile-card-title">
                      {p.nom}
                      {(p.historique || []).length > 0 && (
                        <span className="badge" style={{ background: "#EFEDE6", color: "#7A8299", marginLeft: 6 }} onClick={() => onHistorique(p)}>
                          {p.historique.length} cycle(s)
                        </span>
                      )}
                    </div>
                    <div className="mobile-card-subtitle">{p.telephone ? p.telephone : "Sans téléphone"} • Lot {p.lotId}</div>
                  </div>
                  <span className="badge" style={{ background: s.termine ? "#E8F5E9" : s.retard > 0 ? "#FDE8E8" : "#EFEDE6", color: statutColor }}>
                    {statut}
                  </span>
                </div>

                <div style={{ background: "#F9F8F5", padding: 12, borderRadius: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#445067", marginBottom: 4 }}>
                    <span>Progression ({s.joursPayes}/{s.lot.duree}j)</span>
                    <strong>{fmt(s.paye)}</strong>
                  </div>
                  <div style={{ background: "#EDEAE0", height: 8, borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ width: `${pct}%`, background: s.retard > 0 ? "#9C4221" : "#C08829", height: "100%" }} />
                  </div>
                  <div style={{ fontSize: 11, color: "#7A8299", marginTop: 6 }}>Pack visé: {p.catalogue} — Pack {p.packNumero}</div>
                </div>

                <div className="mobile-card-actions">
                  <button className="btn btn-gold" onClick={() => onVersements(p)}><History size={14} /> Versements</button>
                  {s.termine && !p.packLivre && (
                    <button className="btn btn-green" onClick={() => onLivraison(p)}><Truck size={14} /> Livrer</button>
                  )}
                  {s.termine && (
                    <button className="btn btn-ghost" onClick={() => onCycle(p)}><RotateCcw size={14} /> Nouveau cycle</button>
                  )}
                  <button className="btn btn-ghost" onClick={() => onEdit(p)}><Pencil size={14} /></button>
                  <button className="btn btn-ghost" style={{ color: "#9C4221" }} onClick={() => onDelete(p)}><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Catalogue({ participants, costs, onUpdateCost }) {
  const countFor = (cat, num) => participants.filter((p) => p.catalogue === cat && p.packNumero === num).length;
  return (
    <div>
      <h1 style={styles.h1}>Catalogue de packs</h1>
      <p style={{ fontSize: 13, color: "#7A8299", marginTop: -12, marginBottom: 20 }}>Renseignez le coût d'achat de chaque pack pour suivre la marge dans l'Aperçu.</p>
      {["A", "B"].map((cat) => (
        <div key={cat} style={{ marginBottom: 32 }}>
          <h2 style={styles.h2}>Catalogue {cat}</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {PACKS[cat].map((pack) => {
              const n = countFor(cat, pack.numero);
              return (
                <div key={pack.numero} style={styles.packCard}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: "#1F2A44" }}>Pack {pack.numero}</div>
                    {n > 0 && <div style={{ fontSize: 12, color: "#C08829", fontWeight: 600 }}>{n} visé(s)</div>}
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: "#445067", lineHeight: 1.6, marginBottom: 10 }}>
                    {pack.contenu.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                  <label style={{ fontSize: 11, color: "#7A8299", display: "block", marginBottom: 3 }}>Coût d'achat (F)</label>
                  <input type="number" placeholder="0" value={costs?.[cat]?.[pack.numero] || ""} onChange={(e) => onUpdateCost(cat, pack.numero, e.target.value)} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function ParticipantForm({ initial, onCancel, onSave }) {
  const [nom, setNom] = useState(initial?.nom || "");
  const [telephone, setTelephone] = useState(initial?.telephone || "");
  const [dateInscription, setDateInscription] = useState(initial?.dateInscription || today());
  const [lotId, setLotId] = useState(initial?.lotId || 1);
  const [catalogue, setCatalogue] = useState(initial?.catalogue || "A");
  const [packNumero, setPackNumero] = useState(initial?.packNumero || 1);
  const [premierVersement, setPremierVersement] = useState("");
  const packs = PACKS[catalogue];

  function submit(e) {
    e.preventDefault();
    if (!nom.trim()) return;
    onSave({ nom: nom.trim(), telephone, dateInscription, lotId: Number(lotId), catalogue, packNumero: Number(packNumero), premierVersement });
  }

  return (
    <div style={styles.overlay}>
      <form style={styles.modal} onSubmit={submit}>
        <div style={styles.modalHeader}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600 }}>{initial ? "Modifier le participant" : "Ajouter un participant"}</span>
          <X size={18} style={{ cursor: "pointer" }} onClick={onCancel} />
        </div>
        <div style={styles.modalBody}>
          <Field label="Nom complet"><input value={nom} onChange={(e) => setNom(e.target.value)} required /></Field>
          <Field label="Téléphone"><input value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="77 000 00 00" /></Field>
          <Field label="Date d'inscription"><input type="date" value={dateInscription} onChange={(e) => setDateInscription(e.target.value)} /></Field>
          <Field label="Lot choisi">
            <select value={lotId} onChange={(e) => setLotId(e.target.value)}>
              {LOTS.map((l) => <option key={l.id} value={l.id}>Lot {l.id} — {l.montant}F × {l.duree}j ({fmt(l.montant * l.duree)})</option>)}
            </select>
          </Field>
          {!initial && (
            <Field label="Premier versement (Optionnel)">
              <input type="number" placeholder="Ex: 500" value={premierVersement} onChange={(e) => setPremierVersement(e.target.value)} />
            </Field>
          )}
          <Field label="Catalogue de pack">
            <select value={catalogue} onChange={(e) => { setCatalogue(e.target.value); setPackNumero(1); }}>
              <option value="A">Catalogue A</option>
              <option value="B">Catalogue B</option>
            </select>
          </Field>
          <Field label="Pack visé">
            <select value={packNumero} onChange={(e) => setPackNumero(e.target.value)}>
              {packs.map((p) => <option key={p.numero} value={p.numero}>Pack {p.numero}</option>)}
            </select>
          </Field>
        </div>
        <div style={styles.modalFooter}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn btn-gold">Enregistrer</button>
        </div>
      </form>
    </div>
  );
}

function NewCycleForm({ participant, onCancel, onSave }) {
  const [dateInscription, setDateInscription] = useState(today());
  const [lotId, setLotId] = useState(participant.lotId);
  const [catalogue, setCatalogue] = useState(participant.catalogue);
  const [packNumero, setPackNumero] = useState(1);
  const packs = PACKS[catalogue];

  function submit(e) {
    e.preventDefault();
    onSave({ dateInscription, lotId: Number(lotId), catalogue, packNumero: Number(packNumero) });
  }

  return (
    <div style={styles.overlay}>
      <form style={styles.modal} onSubmit={submit}>
        <div style={styles.modalHeader}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600 }}>Nouveau cycle — {participant.nom}</span>
          <X size={18} style={{ cursor: "pointer" }} onClick={onCancel} />
        </div>
        <div style={styles.modalBody}>
          <p style={{ fontSize: 13, color: "#7A8299", marginTop: 0 }}>Le cycle précédent sera archivé dans l'historique du participant.</p>
          <Field label="Date de début"><input type="date" value={dateInscription} onChange={(e) => setDateInscription(e.target.value)} /></Field>
          <Field label="Nouveau lot">
            <select value={lotId} onChange={(e) => setLotId(e.target.value)}>
              {LOTS.map((l) => <option key={l.id} value={l.id}>Lot {l.id} — {l.montant}F × {l.duree}j</option>)}
            </select>
          </Field>
          <Field label="Catalogue de pack">
            <select value={catalogue} onChange={(e) => { setCatalogue(e.target.value); setPackNumero(1); }}>
              <option value="A">Catalogue A</option>
              <option value="B">Catalogue B</option>
            </select>
          </Field>
          <Field label="Pack visé">
            <select value={packNumero} onChange={(e) => setPackNumero(e.target.value)}>
              {packs.map((p) => <option key={p.numero} value={p.numero}>Pack {p.numero}</option>)}
            </select>
          </Field>
        </div>
        <div style={styles.modalFooter}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
          <button type="submit" className="btn btn-gold">Démarrer le cycle</button>
        </div>
      </form>
    </div>
  );
}

function HistoriqueModal({ participant, onClose }) {
  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600 }}>Cycles précédents — {participant.nom}</span>
          <X size={18} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={styles.modalBody}>
          {(participant.historique || []).length === 0 && <p style={{ color: "#8993AC", fontSize: 13 }}>Aucun cycle archivé.</p>}
          {(participant.historique || []).map((h, i) => (
            <div key={i} style={{ border: "1px solid #EDEAE0", borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>Lot {h.lotId} · {h.dateInscription} → {h.dateFin}</div>
              <div style={{ color: "#445067" }}>Pack : {h.catalogue} — Pack {h.packNumero}</div>
              <div style={{ color: "#445067" }}>Montant collecté : {fmt(h.montantCollecte)}</div>
              <div style={{ color: h.packLivre ? "#3F6B4E" : "#C08829" }}>{h.packLivre ? `Pack livré le ${h.dateLivraison}` : "Pack non livré"}</div>
            </div>
          ))}
        </div>
        <div style={styles.modalFooter}>
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

function VersementsModal({ participant, onClose, onAdd, onRemove }) {
  const s = stats(participant);
  const lot = s.lot;
  const [date, setDate] = useState(today());
  const [montant, setMontant] = useState(lot.montant);
  const [mode, setMode] = useState("Espèces");

  function submit(e) {
    e.preventDefault();
    onAdd({ date, montant: Number(montant), mode });
    setDate(today());
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <span style={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600 }}>Bilan & Versements — {participant.nom}</span>
          <X size={18} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={styles.modalBody}>

          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <div style={{ flex: 1, minWidth: 120, padding: 14, background: "#F5F3ED", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "#7A8299", textTransform: "uppercase", marginBottom: 4 }}>Total Payé</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#1F2A44", fontFamily: "'Fraunces', serif" }}>{fmt(s.paye)}</div>
            </div>
            <div style={{ flex: 1, minWidth: 120, padding: 14, background: "#F5F3ED", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: "#7A8299", textTransform: "uppercase", marginBottom: 4 }}>Reste à payer</div>
              <div style={{ fontSize: 20, fontWeight: 600, color: "#1F2A44", fontFamily: "'Fraunces', serif" }}>{fmt(Math.max(0, s.attendu - s.paye))}</div>
            </div>
            <div style={{ flex: 1, minWidth: 120, padding: 14, background: s.retard > 0 ? "#FDE8E8" : s.joursAvance > 0 ? "#FEF3C7" : "#E8F5E9", borderRadius: 8 }}>
              <div style={{ fontSize: 11, color: s.retard > 0 ? "#9B1C1C" : s.joursAvance > 0 ? "#92400E" : "#166534", textTransform: "uppercase", marginBottom: 4 }}>Statut Actuel</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: s.retard > 0 ? "#9B1C1C" : s.joursAvance > 0 ? "#92400E" : "#166534" }}>
                {s.retard > 0 ? `${s.retard}j de retard` : s.joursAvance > 0 ? `+${s.joursAvance}j d'avance` : "À jour parfait"}
              </div>
            </div>
          </div>

          <form onSubmit={submit} style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "flex-end", flexWrap: "wrap", padding: 16, background: "#fff", border: "1px solid #EDEAE0", borderRadius: 8 }}>
            <Field label="Date"><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
            <Field label="Montant"><input type="number" value={montant} onChange={(e) => setMontant(e.target.value)} /></Field>
            <Field label="Mode">
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                {MODES.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <button className="btn btn-gold" style={{ height: 38, width: "100%", justifyContent: "center" }} type="submit"><Plus size={14} /> Ajouter ce versement</button>
          </form>

          <div style={{ fontSize: 13, color: "#445067", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
            <span>Historique ({participant.versements.length} transactions)</span>
            <span>Jours payés équivalents : <strong>{s.joursPayes} / {s.lot.duree}j</strong></span>
          </div>
          <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #EDEAE0", borderRadius: 6 }}>
            {participant.versements.length === 0 && <div style={{ padding: 14, fontSize: 13, color: "#8993AC" }}>Aucun versement enregistré.</div>}
            {participant.versements.map((v, i) => ({ v, i })).sort((a, b) => new Date(b.v.date) - new Date(a.v.date)).map(({ v, i }) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderBottom: "1px solid #F3F1EB", fontSize: 13 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span style={{ fontWeight: 500 }}>{v.date}</span>
                  <span style={{ color: "#7A8299", fontSize: 11 }}>{v.mode || "—"}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span style={{ fontWeight: 600, color: "#1F2A44" }}>{fmt(v.montant)}</span>
                  <button className="btn btn-ghost" style={{ padding: 4, height: 'auto', border: 'none', color: '#9C4221' }} onClick={() => onRemove(i)}><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmModal({ message, onCancel, onConfirm }) {
  return (
    <div style={styles.overlay}>
      <div style={{ ...styles.modal, maxWidth: 380 }}>
        <div style={styles.modalBody}><p style={{ fontSize: 14, color: "#1F2A44", lineHeight: 1.5 }}>{message}</p></div>
        <div style={styles.modalFooter}>
          <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>
          <button className="btn btn-danger" onClick={onConfirm}><Check size={14} /> Confirmer</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12, width: "100%" }}>
      <label style={{ fontSize: 12, color: "#445067", display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  );
}

const styles = {
  h1: { fontFamily: "'Fraunces', serif", fontSize: 26, fontWeight: 600, color: "#1F2A44", margin: "0 0 20px" },
  h2: { fontFamily: "'Fraunces', serif", fontSize: 17, fontWeight: 600, color: "#1F2A44", margin: "0 0 12px" },
  ledger: { display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "2px solid #1F2A44", paddingBottom: 16, marginBottom: 20, flexWrap: "wrap", gap: 10 },
  ledgerBig: { fontFamily: "'Fraunces', serif", fontSize: 40, fontWeight: 600, color: "#1F2A44", lineHeight: 1 },
  ledgerLabel: { fontSize: 13, color: "#7A8299", marginTop: 4 },
  ledgerPct: { fontFamily: "'Fraunces', serif", fontSize: 30, color: "#C08829", fontWeight: 600 },
  statsRow: { display: "flex", alignItems: "center", gap: 24, marginBottom: 28, flexWrap: "wrap" },
  statBlock: { textAlign: "left" },
  statNum: { fontSize: 24, fontWeight: 600, color: "#1F2A44" },
  statLabel: { fontSize: 12, color: "#7A8299" },
  divider: { width: 1, height: 34, background: "#DAD5C7" },
  packCard: { background: "#fff", border: "1px solid #EDEAE0", borderRadius: 8, padding: 16 },
  overlay: { position: "fixed", inset: 0, background: "rgba(31,42,68,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 150, padding: 16 },
  modal: { background: "#fff", borderRadius: 10, width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #EDEAE0" },
  modalBody: { padding: 20 },
  modalFooter: { display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid #EDEAE0" },
};
