import React from 'react';
import { motion } from 'framer-motion';

const steps = [
  {
    n: 1,
    title: 'Upload receipt to submit claim. We handle the rest.',
    desc: 'Photo or PDF of your tax-free invoice with passport details.',
  },
  {
    n: 2,
    title: 'Gemetra validates everything. No scope for error.',
    desc: 'AI checks VAT rules, merchant eligibility, and refund amount.',
  },
  {
    n: 3,
    title: 'We settle on Stellar. Constant on-chain updates.',
    desc: 'XLM payout to your Freighter or Albedo wallet in seconds.',
  },
  {
    n: 4,
    title: 'Refund delivered on time. Or before time.',
    desc: 'Track every step on Stellar Expert — forever auditable.',
  },
];

/** Atlys winding process path — simplified responsive layout */
export const ProcessRoadmap: React.FC = () => (
  <section className="overflow-hidden px-4 py-24 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-5xl">
      <h2 className="gem-serif text-center text-4xl text-[var(--gem-text)] md:text-5xl">The refund process</h2>
      <p className="mx-auto mt-4 max-w-xl text-center text-[var(--gem-text-muted)]">
        Four steps from receipt to XLM — no airport queues, no paper forms.
      </p>

      <div className="relative mt-20">
        <svg className="absolute inset-0 hidden h-full w-full lg:block" viewBox="0 0 800 600" preserveAspectRatio="none">
          <path
            d="M 80 80 Q 200 80 280 180 T 520 220 T 720 380 T 120 480"
            fill="none"
            stroke="var(--gem-border)"
            strokeWidth="3"
            strokeDasharray="8 8"
          />
        </svg>

        <div className="relative grid gap-16 lg:grid-cols-2 lg:gap-x-24 lg:gap-y-20">
          {steps.map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.12 }}
              className={`flex gap-5 ${i % 2 === 1 ? 'lg:ml-auto lg:max-w-md' : 'lg:max-w-md'}`}
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--gem-ink)] text-lg font-bold text-white shadow-lg">
                {step.n}
              </div>
              <div>
                <h3 className="text-lg font-semibold leading-snug text-[var(--gem-text)]">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--gem-text-muted)]">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);
