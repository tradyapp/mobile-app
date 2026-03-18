'use client';
import { Block, BlockTitle } from 'konsta/react';
import AppNavbar from '@/components/AppNavbar';

export default function SearchTab() {
  return (
    <>
      <AppNavbar title="Search" />
      <Block strong inset>
        <BlockTitle>Search</BlockTitle>
        <p className="text-center py-8">
          Search view
        </p>
      </Block>
    </>
  );
}
