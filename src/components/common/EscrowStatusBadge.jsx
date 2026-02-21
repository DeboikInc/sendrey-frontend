import React from 'react';
import { Shield, Lock, CheckCircle, AlertTriangle, Clock, XCircle } from 'lucide-react';

const ESCROW_STATES = {
  funded: {
    label: 'Escrow Active',
    description: 'Funds are securely held',
    icon: Shield,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20'
  },
  delivery_pending: {
    label: 'Awaiting Confirmation',
    description: 'Pending delivery confirmation',
    icon: Clock,
    color: 'text-yellow-500',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20'
  },
  released: {
    label: 'Escrow Released',
    description: 'Funds have been released',
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20'
  },
  disputed: {
    label: 'Disputed',
    description: 'Funds locked pending review',
    icon: AlertTriangle,
    color: 'text-red-500',
    bg: 'bg-red-500/10',
    border: 'border-red-500/20'
  },
  locked: {
    label: 'Funds Locked',
    description: 'Processing payment',
    icon: Lock,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/20'
  },
  refunded: {
    label: 'Refunded',
    description: 'Funds returned to wallet',
    icon: XCircle,
    color: 'text-gray-500',
    bg: 'bg-gray-500/10',
    border: 'border-gray-500/20'
  }
};

export default function EscrowStatusBadge({ status, darkMode, showDescription = false }) {
  const state = ESCROW_STATES[status] || ESCROW_STATES['funded'];
  const Icon = state.icon;

  if (!showDescription) {
    // Compact badge
    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${state.bg} ${state.border}`}>
        <Icon className={`w-3 h-3 ${state.color}`} />
        <span className={`text-xs font-medium ${state.color}`}>
          {state.label}
        </span>
      </div>
    );
  }

  // Full card
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border ${state.bg} ${state.border}`}>
      <div className={`w-9 h-9 rounded-full ${state.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-4 h-4 ${state.color}`} />
      </div>
      <div>
        <p className={`text-sm font-semibold ${state.color}`}>
          {state.label}
        </p>
        <p className={`text-xs ${darkMode ? 'text-gray-1002' : 'text-gray-600'}`}>
          {state.description}
        </p>
      </div>
    </div>
  );
}