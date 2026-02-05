import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { CheckCircle } from 'lucide-react';

export default function CheckoutSuccess() {
  return (
    <>
      <Head>
        <title>Thank you - Reddit Multi Poster</title>
      </Head>
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="flex justify-center">
            <CheckCircle className="h-16 w-16 text-green-500" aria-hidden="true" />
          </div>
          <h1 className="text-2xl font-semibold text-white">Thank you</h1>
          <p className="text-zinc-400">
            You&apos;re all set. You can now save unlimited communities and post to as many as you
            want at once.
          </p>
          <p className="text-sm text-zinc-500">
            If nothing changed yet, refresh the page or wait a few seconds.
          </p>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-orange-500 px-6 py-3 text-sm font-medium text-white hover:bg-orange-600 transition-colors cursor-pointer"
          >
            Back to app
          </Link>
        </div>
      </div>
    </>
  );
}
