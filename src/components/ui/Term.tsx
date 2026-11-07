"use client";

import { Fragment, type ReactNode } from "react";
import { glossary, inlineTitle, isTermId, termParts, type TermId } from "@/i18n/glossary";
import { useI18n } from "@/i18n/useI18n";
import Tip, { MAX_DEPTH, useTipChain, type TipProps } from "./Tip";

/** A word on a panel whose hint explains it: the dotted underline says there is one. */
const TOP = "cursor-help underline decoration-dotted decoration-1 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm";
/** A word inside a hint that opens a hint of its own: in the accent, underlined. */
const NESTED = "cursor-help font-bold text-accent underline decoration-accent/50 decoration-1 underline-offset-2 outline-none hover:decoration-accent focus-visible:ring-2 focus-visible:ring-accent/50 rounded-sm";
/** A word that would open nothing more – the chain is as deep as it goes, or the word is explained above. */
const SPENT = "font-bold text-ink";

interface TermProps extends Omit<TipProps, "content" | "term" | "label" | "children"> {
  id: TermId;
  /** The words shown; the term's own name by default. */
  children?: ReactNode;
  /** More for the hint under the term's explanation: the figure behind it, what raises it here. */
  extra?: ReactNode;
  /** The hint's heading, when the panel names the figure otherwise than the glossary does. */
  label?: ReactNode;
}

/**
 * A glossary term: hovering, focusing or tapping it opens its explanation,
 * whose own highlighted terms open theirs (Tip). Outside a hint it is drawn
 * as the panel's word with a dotted underline; inside one, in the accent.
 */
export function Term({ id, children, extra, label, className, ...rest }: TermProps) {
  const { locale } = useI18n();
  const chain = useTipChain();
  const entry = glossary(id, locale);
  const shown = children ?? inlineTitle(entry.title);
  if (chain.depth >= MAX_DEPTH || chain.terms.includes(id)) return <span className={className ?? SPENT}>{shown}</span>;
  return (
    <Tip
      {...rest}
      term={id}
      label={label ?? entry.title}
      className={className ?? (chain.depth > 0 ? NESTED : TOP)}
      content={() => (
        <>
          <GlossaryText text={entry.text} />
          {extra && <div className="mt-1.5 border-t border-divider pt-1.5 text-muted">{extra}</div>}
        </>
      )}
    >
      {shown}
    </Tip>
  );
}

/**
 * A text with its `[[term]]` and `[[term|words]]` marks drawn as terms that
 * open their hints; an unknown mark is drawn as its words.
 */
export function GlossaryText({ text }: { text: string }) {
  return (
    <>
      {termParts(text).map((p, i) =>
        p.id === undefined ? (
          <Fragment key={i}>{p.text}</Fragment>
        ) : isTermId(p.id) ? (
          <Term key={i} id={p.id}>
            {p.text}
          </Term>
        ) : (
          <Fragment key={i}>{p.text ?? p.id}</Fragment>
        ),
      )}
    </>
  );
}

/**
 * A hint whose text is an interface string that may mark terms – the top
 * bar's figures, a budget line, a vote – on the element it explains.
 */
export function TextTip({ text, children, ...rest }: Omit<TipProps, "content"> & { text: string }) {
  return (
    <Tip {...rest} content={<GlossaryText text={text} />}>
      {children}
    </Tip>
  );
}
