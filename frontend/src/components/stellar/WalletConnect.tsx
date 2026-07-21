'use client';

import { useState } from 'react';
import { Wallet, LogOut } from 'lucide-react';
import { isFreighterInstalled, connectWallet } from '@/lib/stellar/walletClient';
import { Button } from '@/components/ui/Button';

interface WalletConnectProps {
  onConnect?: (publicKey: string) => void;
  onDisconnect?: () => void;
  connectedKey?: string | null;
}

function truncateKey(key: string) {
  return `${key.slice(0, 6)}...${key.slice(-4)}`;
}

export function WalletConnect({ onConnect, onDisconnect, connectedKey }: WalletConnectProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    setError(null);
    setLoading(true);
    try {
      const installed = await isFreighterInstalled();
      if (!installed) {
        setError('Freighter wallet is not installed. Please install it from freighter.app');
        return;
      }
      const publicKey = await connectWallet();
      onConnect?.(publicKey);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    } finally {
      setLoading(false);
    }
  };

  if (connectedKey) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-800">
          <Wallet className="h-4 w-4" />
          <span title={connectedKey}>{truncateKey(connectedKey)}</span>
        </div>
        <Button variant="outline" size="sm" onClick={onDisconnect}>
          <LogOut className="h-4 w-4 mr-1" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Button onClick={handleConnect} disabled={loading}>
        <Wallet className="h-4 w-4 mr-2" />
        {loading ? 'Connecting...' : 'Connect Freighter Wallet'}
      </Button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
