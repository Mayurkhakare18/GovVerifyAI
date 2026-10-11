import { VerdictDefinition } from '../types';

export const VERDICT_DEFINITIONS: VerdictDefinition[] = [
  {
    verdict: 'SUPPORTED',
    label: 'Supported by Official Evidence',
    badgeColor: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    borderColor: 'border-emerald-500',
    description:
      'Direct, verifiable statements in official notifications, Gazettes of India, ministry press releases, or statutory scheme rules fully confirm every assertion in the claim.',
    exampleScenario:
      'When an official circular confirms both the exact eligibility threshold and the announced benefit figure without discrepancy.',
  },
  {
    verdict: 'PARTIALLY_SUPPORTED',
    label: 'Partially Supported',
    badgeColor: 'text-amber-800 bg-amber-50 border-amber-200',
    borderColor: 'border-amber-500',
    description:
      'The claim contains genuine elements of truth, but distorts key details such as eligibility criteria, geographical scope, installment dates, or benefit ceilings.',
    exampleScenario:
      'A message correctly identifies that a scheme was expanded, but misquotes the income cap or omits required document conditions.',
  },
  {
    verdict: 'CONTRADICTED',
    label: 'Contradicted by Authoritative Sources',
    badgeColor: 'text-rose-800 bg-rose-50 border-rose-200',
    borderColor: 'border-rose-500',
    description:
      'Authoritative government records, official PIB Fact Checks, or ministry gazettes explicitly disprove the claim, demonstrating it to be false or fabricated.',
    exampleScenario:
      'A viral circular claiming an immediate one-time cash transfer under a non-existent ministry program.',
  },
  {
    verdict: 'INSUFFICIENT_EVIDENCE',
    label: 'Insufficient Official Evidence',
    badgeColor: 'text-slate-800 bg-slate-100 border-slate-300',
    borderColor: 'border-slate-400',
    description:
      'No authoritative gazette, ministry notification, or official repository could be retrieved that addresses the assertion. The system never guesses or relies on rumors.',
    exampleScenario:
      'An unconfirmed rumor regarding an unannounced future budget policy for which no government document exists yet.',
  },
];
