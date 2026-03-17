'use client';
import { Block, BlockTitle } from 'konsta/react';
import AppNavbar from '@/components/AppNavbar';

export default function WalletTab() {
  return (
    <>
      <AppNavbar title="Wallet" />
      <Block strong inset>
        <BlockTitle>Wallet</BlockTitle>
        <p className="text-center py-8">
          Página de Wallet
        </p>
      </Block>
    </>
  );
}
