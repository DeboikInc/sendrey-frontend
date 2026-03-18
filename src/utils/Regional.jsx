import { useState } from "react";

const NAV_ITEMS = [
  {
    key: "home",
    label: "Home",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    key: "transfer",
    label: "Transfer",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="17 1 21 5 17 9" />
        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
        <polyline points="7 23 3 19 7 15" />
        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
      </svg>
    ),
  },
  {
    key: "transactions",
    label: "History",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    key: "cards",
    label: "Cards",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    key: "profile",
    label: "Profile",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
];

const TRANSACTIONS = [
  { id: 1, name: "Netflix Subscription", date: "Today, 10:23 AM", amount: -150, icon: "N", color: "#E50914" },
  { id: 2, name: "Salary Credit", date: "Yesterday, 9:00 AM", amount: 800, icon: "S", color: "#1A73E8" },
  { id: 3, name: "Shopping", date: "Mar 16, 2:15 PM", amount: -400, icon: "J", color: "#FF6600" },
  { id: 5, name: "Transfer from Matt", date: "Mar 14, 3:30 PM", amount: 200, icon: "B", color: "#34A853" },
];

const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(Math.abs(n));

export default function BankHome() {
  const [active, setActive] = useState("home");
  const [balanceHidden, setBalanceHidden] = useState(false);

  return (
    <div style={{
      minHeight: "100vh",
      background: "#F0F4F8",
      fontFamily: "'DM Sans', 'Segoe UI', sans-serif",
      display: "flex",
      flexDirection: "column",
      maxWidth: 430,
      margin: "0 auto",
      position: "relative",
    }}>

      {/* Header */}
      <div style={{
        background: "#fff",
        padding: "18px 20px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid #E8EDF2",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 42, height: 42, borderRadius: "50%",
            background: "linear-gradient(135deg, #5BB8F5, #2A8FD4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#fff", fontWeight: 700, fontSize: 15,
          }}>
            AO
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 11, color: "#8A9BB0", fontWeight: 500 }}>Good morning,</p>
            <p style={{ margin: 0, fontSize: 15, color: "#1A2B3C", fontWeight: 700 }}>Steven Adams</p>
          </div>
        </div>
        <div style={{ position: "relative", cursor: "pointer" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#8A9BB0" strokeWidth="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <span style={{
            position: "absolute", top: -2, right: -2,
            width: 8, height: 8, borderRadius: "50%",
            background: "#5BB8F5", border: "2px solid #fff",
          }} />
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 90 }}>

        {/* Balance Card */}
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{
            background: "linear-gradient(135deg, #1A7EC4 0%, #5BB8F5 100%)",
            borderRadius: 20,
            padding: "24px 22px",
            color: "#fff",
            position: "relative",
            overflow: "hidden",
          }}>
            <div style={{
              position: "absolute", top: -30, right: -30,
              width: 130, height: 130, borderRadius: "50%",
              background: "rgba(255,255,255,0.07)",
            }} />
            <div style={{
              position: "absolute", bottom: -20, right: 70,
              width: 90, height: 90, borderRadius: "50%",
              background: "rgba(255,255,255,0.05)",
            }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <p style={{ margin: 0, fontSize: 13, opacity: 0.85, fontWeight: 500 }}>Total Balance</p>
              <button
                onClick={() => setBalanceHidden(h => !h)}
                style={{
                  background: "rgba(255,255,255,0.18)", border: "none",
                  borderRadius: 8, padding: "3px 10px",
                  color: "#fff", fontSize: 11, cursor: "pointer", fontWeight: 600,
                }}
              >
                {balanceHidden ? "Show" : "Hide"}
              </button>
            </div>

            <p style={{ margin: "0 0 20px", fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>
              {balanceHidden ? "$ ••••••" : "$ 8,248.00"}
            </p>

            <div style={{ display: "flex", gap: 28 }}>
              <div>
                <p style={{ margin: 0, fontSize: 11, opacity: 0.75 }}>Income</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>$4,216</p>
              </div>
              <div style={{ width: 1, background: "rgba(255,255,255,0.25)" }} />
              <div>
                <p style={{ margin: 0, fontSize: 11, opacity: 0.75 }}>Expenses</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>$2,250</p>
              </div>
            </div>

            <p style={{ margin: "16px 0 0", fontSize: 12, opacity: 0.6, letterSpacing: 2 }}>**** **** **** 4821</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ padding: "22px 20px 0" }}>
          <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: "#1A2B3C" }}>Quick Actions</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            {[
              {
                label: "Deposit",
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2A8FD4" strokeWidth="2.2"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              },
              {
                label: "Transfer",
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2A8FD4" strokeWidth="2.2"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
              },
              {
                label: "Pay Bills",
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2A8FD4" strokeWidth="2.2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
              },
              {
                label: "More",
                icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2A8FD4" strokeWidth="2.5"><circle cx="5" cy="12" r="1.2" fill="#2A8FD4"/><circle cx="12" cy="12" r="1.2" fill="#2A8FD4"/><circle cx="19" cy="12" r="1.2" fill="#2A8FD4"/></svg>
              },
            ].map((item) => (
              <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 54, height: 54,
                  background: "#EBF5FC",
                  borderRadius: 16,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  cursor: "pointer",
                  border: "1px solid #D0E8F7",
                }}>
                  {item.icon}
                </div>
                <p style={{ margin: 0, fontSize: 11, color: "#5A7290", fontWeight: 600 }}>{item.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Savings Banner */}
        <div style={{ padding: "22px 20px 0" }}>
          <div style={{
            background: "#fff",
            borderRadius: 16,
            padding: "14px 16px",
            border: "1px solid #E0ECF8",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12,
                background: "#EBF5FC",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#2A8FD4" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                  <path d="M2 17l10 5 10-5"/>
                  <path d="M2 12l10 5 10-5"/>
                </svg>
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#1A2B3C" }}>Savings Wallet</p>
                <p style={{ margin: 0, fontSize: 11, color: "#8A9BB0" }}>4.5% p.a. interest</p>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#2A8FD4" }}>$6,500</p>
              <p style={{ margin: 0, fontSize: 10, color: "#8A9BB0" }}>Locked till Apr</p>
            </div>
          </div>
        </div>

        {/* Transactions */}
        <div style={{ padding: "22px 20px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "#1A2B3C" }}>Recent Transactions</p>
            <p style={{ margin: 0, fontSize: 12, color: "#2A8FD4", fontWeight: 600, cursor: "pointer" }}>See all</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {TRANSACTIONS.map((txn) => (
              <div key={txn.id} style={{
                background: "#fff",
                borderRadius: 14,
                padding: "13px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                border: "1px solid #EEF3F8",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 12,
                    background: txn.color + "18",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: txn.color, fontWeight: 800, fontSize: 15,
                  }}>
                    {txn.icon}
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "#1A2B3C" }}>{txn.name}</p>
                    <p style={{ margin: 0, fontSize: 11, color: "#8A9BB0" }}>{txn.date}</p>
                  </div>
                </div>
                <p style={{
                  margin: 0, fontSize: 13, fontWeight: 700,
                  color: txn.amount > 0 ? "#2A8FD4" : "#1A2B3C",
                }}>
                  {txn.amount > 0 ? "+" : "-"}{fmt(txn.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{
        position: "fixed",
        bottom: 0,
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: 430,
        background: "#fff",
        borderTop: "1px solid #E8EDF2",
        display: "flex",
        justifyContent: "space-around",
        padding: "10px 0 18px",
        zIndex: 100,
      }}>
        {NAV_ITEMS.map((item) => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => setActive(item.key)}
              style={{
                background: "none",
                border: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
                cursor: "pointer",
                color: isActive ? "#2A8FD4" : "#A0B4C8",
                padding: "4px 10px",
                borderRadius: 10,
                transition: "color 0.2s",
              }}
            >
              {item.icon}
              <span style={{ fontSize: 10, fontWeight: isActive ? 700 : 500 }}>{item.label}</span>
              {isActive && (
                <div style={{
                  width: 4, height: 4, borderRadius: "50%",
                  background: "#2A8FD4",
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}