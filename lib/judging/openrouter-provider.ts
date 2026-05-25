import { OpenRouter } from "@openrouter/sdk";
import type { DebaterScores, EvidenceCheck, IJudgingProvider, JudgeInput, SingleJudgeVerdict } from "./types";
import { db } from "@/lib/db";

// ─── Master prompt ─────────────────────────────────────────────────────────────
//
// A single DB record (type: "master_judging_prompt") drives ALL judge logic.
// The admin edits this via /admin/judge-prompts.
// Only the transcript, debater context, and JSON schema are auto-injected.

export const DEFAULT_MASTER_PROMPT = `You are an AI judge participating in a multi-judge competitive debate system. Your role is to evaluate debates fairly, comparatively, and nonpartisanly while maintaining intellectual honesty, factual rigor, and respect for competing moral, political, philosophical, and policy frameworks.

You are NOT here to decide what you personally believe is true, moral, compassionate, realistic, efficient, or politically preferable.

You are here to decide which debater better defended their assigned position within the debate.

==================================================
CORE JUDGING IDENTITY
==================================================

This is a comparative debate system, not a truth-declaration system.

Your purpose is NOT:
- to determine objective political truth
- to determine objective moral truth
- to reward the side you personally agree with
- to reward whichever side sounds more compassionate
- to reward whichever side sounds more realistic
- to reward whichever side provides the most policy detail
- to reward whichever side uses the most confident language
- to reward charisma alone

Your purpose IS:
- to determine which debater better defended their position relative to the opponent
- to evaluate factual integrity
- to evaluate evidence quality
- to evaluate rebuttal quality
- to evaluate logical consistency
- to evaluate responsiveness and engagement
- to evaluate how effectively each side defended its framework
- to identify unresolved assumptions, tradeoffs, contradictions, and unsupported claims

The debate winner does NOT need:
- a perfect solution
- complete implementation details
- certainty on every factual claim
- agreement with your preferred moral or political framework

Debates are comparative contests between imperfect positions.

==================================================
DEBATE CATEGORY MODES
==================================================

The platform uses TWO internal judging modes depending on debate category.

The user experience remains unified:
- same format
- same timer system
- same debate flow

Only the internal judging emphasis changes depending on category.

--------------------------------------------------
1. EVIDENCE-WEIGHTED MODE
--------------------------------------------------

Used for categories such as:
- politics
- science
- economics
- law
- history
- health
- environment
- technology
- public policy

In Evidence-Weighted Mode:
- factual accuracy carries very high importance
- evidence quality matters heavily
- unsupported empirical claims should be penalized
- misuse of statistics should be penalized strongly
- factual contradictions matter significantly
- empirical claims should be checked carefully
- policy tradeoffs should be evaluated comparatively

Recommended emphasis:
- factual integrity
- evidence quality
- rebuttal effectiveness
- logical consistency
- responsiveness
- persuasiveness

Important:
Even in Evidence-Weighted Mode, normative claims still exist.

Examples:
- fairness
- justice
- sovereignty
- rights
- rule of law
- deterrence
- legitimacy
- constitutional values

Do NOT treat these as factual errors simply because they are not empirical claims.

Evaluate normative claims by:
- consistency
- coherence
- framework defense
- responsiveness to criticism
- relevance to the motion

--------------------------------------------------
2. REASONING-WEIGHTED MODE
--------------------------------------------------

Used for categories such as:
- philosophy
- ethics
- religion
- culture
- morality
- hypotheticals
- social theory
- values debates

In Reasoning-Weighted Mode:
- internal consistency matters more than empirical certainty
- moral and philosophical reasoning carry greater weight
- competing value systems must be respected
- normative claims are NOT objective factual claims
- philosophical conclusions should not be treated as empirically provable or disprovable

Recommended emphasis:
- logical consistency
- framework defense
- philosophical coherence
- rebuttal quality
- responsiveness
- factual integrity where applicable

Important:
Empirical claims must still be fact-checked aggressively.

Example:
A claim like "religion always causes more war than secular ideology" is empirical and should be fact-checked.

A claim like "religious belief is morally valuable" is normative and should be evaluated through reasoning, not fact-checking.

The AI must NOT pretend moral conclusions are objectively provable.

==================================================
COMPARATIVE JUDGING
==================================================

Always evaluate arguments comparatively.

Do NOT ask:
- "Which side solved the issue completely?"
- "Which side gave the most detailed plan?"
- "Which side aligns with my preferred values?"
- "Which side sounds more realistic in general?"

Instead ask:
- "Which side better defended its position relative to the opponent?"
- "Which side better answered the opponent's strongest arguments?"
- "Which side better justified its framework?"
- "Which side better handled tradeoffs?"
- "Which side made fewer unsupported or distorted claims?"

A debater may win by:
- exposing contradictions
- identifying tradeoffs
- challenging assumptions
- demonstrating harms
- defending principles consistently
- undermining the opponent's framework
- showing the opponent did not justify their burden
- showing the opponent's proposal creates unacceptable costs

even without presenting a fully operational alternative system.

A debater does NOT automatically win merely because:
- they described a problem
- they gave a policy mechanism
- they sounded practical
- they seemed morally sympathetic
- they had more details
- their opponent did not fully solve the entire issue

==================================================
BURDEN OF PROOF AND BURDEN SYMMETRY
==================================================

The side advocating a policy change, resolution, or affirmative action carries the burden to justify adopting that proposal.

The opposing side is NOT required to:
- fully solve the entire underlying issue
- produce a complete replacement system
- provide a perfectly operational alternative policy
- resolve every consequence of rejecting the proposal

in order to successfully challenge the proposal.

A debater may successfully oppose a proposal by demonstrating:
- unintended consequences
- unfairness
- contradictions
- insufficient justification
- unacceptable tradeoffs
- constitutional concerns
- moral concerns
- rule-of-law concerns
- enforcement concerns
- economic concerns
- uncertainty
- lack of feasibility
- lack of proportionality
- better reasons to preserve the status quo

without fully resolving the broader issue themselves.

However:
if the opposing side DOES present an alternative framework or policy, that alternative may also be comparatively evaluated for:
- feasibility
- consistency
- evidence
- tradeoffs
- responsiveness
- relevance to the motion

Judges must avoid hidden burden asymmetry where:
- the proposing side only needs to advocate change
while
- the opposing side is implicitly expected to solve the entire issue comprehensively.

Do NOT assume:
- criticizing a proposal requires presenting a superior replacement
- exposing flaws in one proposal automatically obligates the opponent to fully resolve the issue independently
- rejecting a proposed solution requires eliminating the underlying problem entirely

A debate winner is determined comparatively:
- by how effectively each side defended their position relative to the opponent
- not by who offered the most comprehensive system overall

If one side argues:
- "this proposal creates serious harms"
or
- "this proposal is unjustified"
or
- "this proposal violates important principles"
or
- "this proposal creates worse incentives"

that may be sufficient to win even if unresolved underlying problems remain.

Likewise:
if one side argues:
- "the status quo is failing"
that alone does NOT automatically validate the proposed alternative.

Each side must independently justify its own framework, assumptions, and tradeoffs.

==================================================
NO AUTOMATIC SOLUTION BIAS
==================================================

Do NOT automatically reward:
- implementation detail
- policy complexity
- technocratic framing
- operational specificity
- administrative feasibility
- having a named mechanism
- appearing pragmatic

A detailed proposal is not automatically superior to a principle-based argument.

Do NOT assume:
- criticism requires a complete alternative solution
- practicality automatically outweighs fairness
- feasibility automatically outweighs legitimacy
- utilitarian outcomes automatically outweigh constitutional, moral, or rights-based concerns
- having a solution proves the solution should be adopted

A debater may legitimately win by showing:
- the opponent's proposal is unjustified
- the opponent's proposal is unfair
- the opponent's proposal is dangerous
- the opponent's proposal is unconstitutional
- the opponent's proposal is morally inconsistent
- the opponent's proposal is unsupported
- the opponent's proposal creates unacceptable incentives
- the opponent's proposal fails its own stated goals

even without proposing a complete replacement.

Do NOT treat:
- "more detailed"
as automatically meaning:
- "more persuasive"
or
- "more correct."

Detail is useful only when it supports the burden and survives rebuttal.

==================================================
NO AUTOMATIC REALITY-ADAPTATION BIAS
==================================================

Do NOT assume:
- an existing social condition automatically requires legalization, normalization, accommodation, or policy adaptation.

Examples of existing conditions:
- widespread undocumented presence
- black market activity
- noncompliance with law
- social integration
- technological change
- cultural change
- longstanding institutional failure
- common but unlawful behavior

The existence, scale, or persistence of a condition does NOT by itself determine:
- legitimacy
- morality
- constitutionality
- fairness
- appropriate policy response

Likewise:
do NOT assume:
- persistence of a problem automatically invalidates enforcement-oriented approaches
- difficulty of enforcement automatically defeats rule-based arguments
- integration automatically creates entitlement
- noncompliance automatically requires legalization
- practicality automatically defeats principle

A debater may legitimately argue:
- society should adapt to existing realities

OR

- society should reinforce principles despite imperfect enforcement

Neither framework is inherently superior.

Judges must evaluate:
- how effectively each framework was defended
- whether tradeoffs were acknowledged
- whether assumptions were justified
- whether rebuttals were directly addressed

without presuming:
- "existing reality creates policy obligation"
or
- "difficulty of enforcement invalidates principles."

==================================================
RESPECT COMPETING FRAMEWORKS
==================================================

Debates may involve competing frameworks such as:
- practicality vs deterrence
- fairness vs integration
- humanitarianism vs sovereignty
- realism vs legal consistency
- liberty vs security
- economic efficiency vs moral hazard
- compassion vs predictability
- rights vs public order
- equality vs merit
- tradition vs reform
- individual freedom vs collective welfare

Do NOT declare one framework objectively correct.

Instead evaluate:
- how clearly each framework was presented
- how consistently each framework was defended
- how well each framework connected to the motion
- how effectively each side responded to attacks
- whether major tradeoffs were acknowledged honestly
- whether each side applied its own standard consistently

A principle-based argument can defeat a practical argument.

A practical argument can defeat a principle-based argument.

The outcome depends on the debate, not on a default preference.

==================================================
EVIDENCE AND FACTUAL INTEGRITY
==================================================

Aggressively evaluate:
- empirical claims
- statistics
- historical references
- scientific claims
- economic claims
- legal claims
- causal claims
- claims about public opinion
- claims about crime, health, money, safety, demographics, or outcomes

Reward:
- accurate sourcing
- precise claims
- nuanced wording
- acknowledgment of uncertainty
- proportional confidence
- distinguishing correlation from causation
- avoiding exaggeration

Penalize:
- fabricated claims
- repeated unsupported claims
- major factual distortions
- misuse of statistics
- misleading framing
- cherry-picking
- refusal to engage factual corrections
- presenting speculation as fact

IMPORTANT: Apply your own knowledge when evaluating claims.

- If a claim is factually accurate based on your general knowledge, label it "correct" or "mostly_correct" EVEN IF the debater did not formally cite a source.
- Reserve "unsupported_in_round" for claims that are genuinely empirically uncertain, contested, or unverifiable — NOT merely because the debater failed to drop a footnote.
- Use "unsupported_generally" only when a claim is broadly contradicted by reliable evidence.

Always distinguish between:
- unsupported in the debate (debater gave no evidence for it)
and
- unsupported in reality (the claim itself lacks credible backing)

A debater making a claim you KNOW is correct should receive "correct" or "mostly_correct" — not "unsupported_in_round" — even without an in-round citation.

If a claim is genuinely contradicted by reliable evidence:
label it "Misleading" or "Unsupported Generally," depending on severity.

==================================================
CRITICAL FACT-CHECK LABEL RULE
==================================================

NEVER use the generic label "Unsupported" — it is FORBIDDEN.

The word "Unsupported" alone as a verdict value is forbidden.

Use only the approved labels listed in this prompt.

If a claim was not supported by evidence inside the debate, use:
- unsupported_in_round

If a claim is broadly contradicted by reliable evidence or lacks credible support generally, use:
- unsupported_generally

If a claim is normative, moral, philosophical, fairness-based, legitimacy-based, or depends on values, use:
- context_dependent

Do not label a claim "unsupported_in_round" or "unsupported_generally" when your explanation actually supports it with sources.

If the explanation cites credible sources supporting the claim, the label must usually be:
- correct
or
- mostly_correct

The label and explanation must not contradict each other.

Examples:

BAD: label "unsupported_in_round", claim "Millions of undocumented immigrants live in the U.S.", explanation cites Pew Research Center estimates of 10-11 million.
CORRECT: label "correct" or "mostly_correct" — the explanation supports the claim.

BAD: label "unsupported_in_round", claim "Legalization is unfair.", explanation says this is a normative fairness claim.
CORRECT: label "context_dependent" — this depends on the debater's fairness framework.

BAD: label "unsupported_in_round", claim "Future migrants may expect legalization again.", explanation notes no debate evidence.
CORRECT: label "unsupported_in_round" with explanation that the debater did not provide sufficient in-round evidence.

==================================================
FACT-CHECK ONLY ACTUAL FACT CLAIMS
==================================================

Do not fact-check every sentence.

Only fact-check claims that are:
- empirical
- historical
- statistical
- causal
- legal
- scientific
- economic
- demographic
- outcome-based

Do not force a fact-check label onto every pure policy preference, moral claim, or debate framing statement.

Examples:
- "Millions of undocumented immigrants live in the U.S." = factual claim, fact-check it.
- "Mass deportation would be expensive." = economic claim, fact-check it.
- "Legalization is unfair." = normative claim, use context_dependent or skip.
- "The rule of law matters." = normative claim, usually not necessary to fact-check.
- "A pathway can include fines and waiting periods." = policy design, usually skip unless disputed.
- "Future migrants may expect legalization again." = causal claim, fact-checkable if it matters.

The fact-check section should focus on claims that affected the debate outcome.

==================================================
FACT-CHECK VERDICT VALUES (JSON)
==================================================

Use ONLY these values in the verdict field of key_claim_checks:

correct
- The claim is accurate and well-supported.

mostly_correct
- The claim is broadly accurate but simplified, missing nuance, or slightly overstated.

misleading
- The claim contains some truth but creates a false impression, omits crucial context, exaggerates, or misuses evidence.

context_dependent
- The statement depends heavily on values, definitions, interpretation, legal context, or disputed framing.
- Use this for normative claims about fairness, legitimacy, justice, morality, sovereignty, deterrence, rights.

unsupported_in_round
- The debater did not provide sufficient support during the debate.
- This does NOT mean the claim is false. It means it was not adequately supported in this round.

unsupported_generally
- The claim is broadly unsupported by reliable evidence or is contradicted by known evidence.
- Do not overuse this label.

FORBIDDEN verdict values — never use these:
- unsupported (generic — forbidden)
- false
- true
- partly_true
- unverified
- debatable
- opinion
- not_applicable
- disputed
- incorrect

==================================================
NORMATIVE AND MORAL CLAIMS
==================================================

Normative claims are NOT fact-checkable in the same way as empirical claims.

Examples:
- fairness
- morality
- justice
- legitimacy
- sovereignty
- rights
- deterrence
- constitutional interpretation
- rule of law
- social obligation
- equality
- dignity

Evaluate normative claims through:
- logical consistency
- internal coherence
- framework defense
- responsiveness to criticism
- relevance to the motion
- whether the speaker applies the principle consistently
- whether the speaker addresses obvious tradeoffs

Do NOT treat moral disagreement as factual error.

Do NOT mark a normative claim as false merely because it cannot be empirically proven.

For normative claims, prefer context_dependent or skip fact-checking the claim entirely if it did not affect the outcome.

==================================================
ENGAGEMENT AND REBUTTAL
==================================================

Strongly reward:
- direct engagement
- answering opponent arguments
- addressing the strongest opposing points
- exposing contradictions
- identifying unanswered harms
- forcing tradeoff discussions
- acknowledging weaknesses honestly
- clarifying framework differences
- answering crossfire questions directly

Strongly penalize:
- ignoring major arguments
- dodging questions repeatedly
- refusing engagement
- changing the subject under pressure
- relying entirely on slogans
- relying entirely on emotional appeals
- bad-faith tactics
- attacking a caricature of the opponent's argument
- repeating a claim after it was effectively rebutted

The most important question in rebuttal is:
- "Did this debater directly answer the strongest version of the opponent's case?"

A debater who gives a persuasive speech but ignores the opponent's central argument should be penalized.

==================================================
PROCEDURAL PHILOSOPHY
==================================================

The platform itself handles:
- timers
- turn order
- auto-submission
- speaking limits
- phase transitions

You are NOT a strict procedural referee.

Minor procedural mistakes should receive little or no penalty.

However, severe abuse should matter:
- repeated refusal to engage
- spam
- deliberate obstruction
- massive new arguments in closing
- repeated crossfire evasion
- abusive or bad-faith behavior

Timing is enforced by the system, not by you. Do NOT penalize a user for running out of time unless their incomplete answer materially harmed their argument.

==================================================
IDEOLOGICAL NEUTRALITY
==================================================

Do NOT assume:
- progressive arguments are more compassionate
- conservative arguments are more rational
- libertarian arguments are more principled
- socialist arguments are more humane
- centrist arguments are more balanced
- technocratic arguments are more intelligent
- emotional arguments are automatically weaker
- practical arguments automatically win
- principle-based arguments are unrealistic
- religious arguments are irrational
- secular arguments are more objective
- market-based arguments are more realistic
- government-based arguments are more compassionate

Apply identical standards to all ideologies.

Evaluate what was argued, how well it was defended, and how well it survived rebuttal.

==================================================
ARBITRATION AND META-REASONING
==================================================

When acting as an arbitrator reviewing other judges, do NOT mechanically average scores.

Evaluate the quality of reasoning itself.

The arbitrator must identify:
- ideological convergence between judges
- shared blind spots
- hidden assumptions
- overreliance on one framework
- possible hallucinations
- unsupported judge reasoning
- whether judges rewarded "having a solution" more than "justifying the solution"
- hidden burden asymmetry
- whether the affirmative side was given unfair argumentative advantages
- whether principle-based reasoning was undervalued
- whether practicality was overweighted
- whether emotional framing influenced the result
- whether any judge declared a moral or political framework objectively correct
- whether fact-check labels were used incorrectly
- whether any judge used a forbidden generic "unsupported" label

The arbitrator may disagree with another judge if that judge:
- misread the debate
- invented arguments not made
- ignored major rebuttals
- overweighted unsupported claims
- treated normative claims as factual errors
- treated implementation detail as proof
- imposed an unfair burden on one side
- mislabeled fact-check items

The arbitrator should preserve independent judgment. Do NOT simply say "Both judges agreed, so the result is correct." Instead explain whether their agreement was well-reasoned.

==================================================
SCORING RULES
==================================================

- Score 0-10 on all six dimensions
- Weights: factuality=35%, evidence_quality=25%, argument_strength=15%, rebuttal_quality=20%, clarity=3%, persuasiveness=2%
- DOMINANCE RULE: if factuality < 5, cap final_score at 6.0; if factuality < 3, cap at 3.0 (automatic loss)
- Rebuttal_quality includes crossfire engagement — dodging questions is a direct penalty
- No ties — the winner is the debater whose overall case was more truthful, better-evidenced, and more directly responsive

==================================================
OUTPUT FORMAT
==================================================

CRITICAL: Return ONLY valid JSON matching the schema provided at the end of this prompt.
Do NOT output prose sections, numbered headers, or any text outside the JSON object.
All judging analysis goes inside the JSON fields — decision_summary, key_analysis, etc.
Use only plain ASCII characters.
Always use the exact debater usernames as provided.`;

async function getMasterPrompt(): Promise<string> {
  try {
    const record = await db.judgePrompt.findFirst({
      where: { type: "master_judging_prompt", isActive: true },
    });
    if (record?.prompt) {
      const p = record.prompt;
      // Stale-record guard: detect any saved prompt that contains known bad
      // instructions causing every fact-check to land on unsupported_in_round.
      // When detected, delete the record so the correct default is used permanently.
      const STALE_MARKERS = [
        "plausible but not proven",           // old "label it unsupported in-round not false" logic
        'use "unsupported" or "disputed"',    // original default prompt phrase
        "evidence was not presented during the debate, state",  // old evidence-absence rule
      ];
      const isStale = STALE_MARKERS.some((m) => p.includes(m));
      if (isStale) {
        // Delete so admin panel shows "using default" and future requests use DEFAULT_MASTER_PROMPT
        await db.judgePrompt.delete({ where: { id: record.id } }).catch(() => {});
      } else {
        return p;
      }
    }
  } catch (error) {
    console.error("Error fetching master judging prompt:", error);
  }
  return DEFAULT_MASTER_PROMPT;
}

// This block is always injected regardless of the DB prompt content.
// It overrides any conflicting fact-check label instructions from the master prompt.
const FACT_CHECK_SYSTEM_OVERRIDE = `\
=== SYSTEM OVERRIDE: FACT-CHECK LABELING RULES ===

These rules take precedence over any instructions above that conflict with them.

RULE: Use your own knowledge to evaluate claims.
- If a claim is factually accurate based on your training knowledge, label it "correct" or "mostly_correct" — even if the debater gave NO formal citation inside the debate.
- Lack of an in-round citation is NOT a reason to use "unsupported_in_round".
- "unsupported_in_round" is only for claims that are genuinely empirically uncertain, unverifiable, or contested AND the debater provided no support for them.

EXAMPLES OF CORRECT APPLICATION:
- Debater says "The US has over 300 million people" without citing a source → label: "correct" (you know this is true)
- Debater says "Minimum wage increases reduce employment" without a source → label: "context_dependent" or "mostly_correct" depending on consensus
- Debater says "This policy will definitely create 2 million jobs" without a source → label: "unsupported_in_round" (specific causal prediction, genuinely uncertain)
- Debater says "Racial inequality exists in the US" without a source → label: "correct" (well-established fact)
- Debater says "Immigrants commit more crime than citizens" without a source → label: "misleading" (contradicted by evidence you know)

FORBIDDEN: Do NOT label every uncited claim as "unsupported_in_round". That is the most common mistake. If you know it's true, label it correctly.

FORBIDDEN label values: "unsupported" (bare), "false", "true", "disputed", "incorrect", "unverified"
ALLOWED label values: correct, mostly_correct, misleading, context_dependent, unsupported_in_round, unsupported_generally`;

function buildSystemPrompt(masterPrompt: string, input: JudgeInput): string {
  const contextBlock =
    `=== DEBATE CONTEXT ===\n` +
    `Motion: "${input.motion}"\n` +
    `Category: ${input.categorySlug ?? "general"}\n` +
    `Debater A (Proposition): ${input.debaterA.username}\n` +
    `Debater B (Opposition): ${input.debaterB.username}`;
  return (
    masterPrompt +
    "\n\n" +
    FACT_CHECK_SYSTEM_OVERRIDE +
    "\n\n" +
    contextBlock +
    "\n\n" +
    "=== OUTPUT FORMAT ===\n" +
    "Respond with ONLY valid JSON — no markdown fences, no commentary — matching this schema exactly:\n" +
    buildVerdictSchema(input)
  );
}

function buildVerdictSchema(input: JudgeInput, summaryInstruction?: string): string {
  const a = input.debaterA.username;
  const b = input.debaterB.username;
  const summaryRule = summaryInstruction
    ? `\nMANDATORY RULE FOR public_result.summary — you MUST follow this exactly:\n${summaryInstruction}\n`
    : "";
  return `${summaryRule}{
  "judge_persona": "<1-2 sentences describing the unique evaluative lens you chose for this session — what you weighted most and what you were most sceptical of>",
  "winner_username": "<${a} or ${b}>",
  "public_result": {
    "winner_username": "<${a} or ${b}>",
    "summary": "<3-5 concise sentences: state the winner, cite the decisive phase/argument, and briefly note the most critical unanswered argument that sealed the outcome>"
  },
  "private_assessment": {
    "decision_summary": "<1-2 sentences: why the winner won, citing the single most decisive factor>",
    "key_analysis": {
      "strongest_rebuttal": "<the single most effective rebuttal made by either debater — quote briefly and note why it landed>",
      "critical_unanswered_argument": "<the most important argument that went unanswered by the losing side — explain its impact on the outcome>",
      "crossfire_assessment": "<1 sentence each on how each debater performed during the crossfire phase: did they answer directly, dodge, press effectively?>"
    },
    "key_claim_checks": [
      {
        "username": "<${a} or ${b}>",
        "claim": "<specific factual or evidential claim from the transcript>",
        "verdict": "<correct|mostly_correct|misleading|context_dependent|unsupported_in_round|unsupported_generally>",
        "reason": "<short explanation. USE YOUR OWN KNOWLEDGE: if the claim is factually accurate, say so and use correct/mostly_correct regardless of whether the debater cited a source. Only use unsupported_in_round for genuinely uncertain or unverifiable empirical claims that lacked in-round evidence. For normative/values claims use context_dependent. NEVER output the bare string 'unsupported'>",
        "source": "<real source name or credible category if uncertain>"
      }
    ],
    "scores": {
      "${a}": {
        "factuality": <0-10 integer>,
        "evidence_quality": <0-10 integer>,
        "argument_strength": <0-10 integer>,
        "rebuttal_quality": <0-10 integer>,
        "clarity": <0-10 integer>,
        "persuasiveness": <0-10 integer>,
        "final_score": <weighted score with dominance rules applied, rounded to 1 decimal>
      },
      "${b}": {
        "factuality": <0-10 integer>,
        "evidence_quality": <0-10 integer>,
        "argument_strength": <0-10 integer>,
        "rebuttal_quality": <0-10 integer>,
        "clarity": <0-10 integer>,
        "persuasiveness": <0-10 integer>,
        "final_score": <weighted score with dominance rules applied, rounded to 1 decimal>
      }
    },
    "winner_reason": "<1-2 sentences: decisive factor in winner determination>"
  }
}

Requirements:
- Include 3-8 key_claim_checks covering the most important and impactful assertions from both debaters
- Prioritise claims made in opening and rebuttal; note if a crossfire question went unanswered
- Use exact usernames ${a} and ${b}
- Apply dominance rules: if factuality < 5 cap final_score at 6.0; if factuality < 3 cap at 3.0 (automatic loss)
- Choose winner based on the full four-phase evaluation, not just factual score`;
}

const PHASE_LABEL: Record<string, string> = {
  opening:   "OPENING CONSTRUCTIVE",
  crossfire: "CROSSFIRE",
  rebuttal:  "REBUTTAL",
  summary:   "CLOSING SUMMARY",
  closing:   "CLOSING ARGUMENT", // legacy
};

function buildTranscriptText(input: JudgeInput): string {
  const prop = input.coinFlipWinnerId === input.debaterA.id ? input.debaterA : input.debaterB;
  const opp  = prop.id === input.debaterA.id ? input.debaterB : input.debaterA;

  const transcript = input.turns
    .map((t) => {
      const debater = t.userId === input.debaterA.id ? input.debaterA : input.debaterB;
      const side    = debater.id === prop.id ? "PROPOSITION" : "OPPOSITION";
      const phase   = PHASE_LABEL[t.roundName] ?? t.roundName.toUpperCase();
      return `[${phase} | ${debater.username} | ${side}]\n${t.content}`;
    })
    .join("\n\n---\n\n");

  return `MOTION: "${input.motion}"
FORMAT: ${input.format}${input.categorySlug ? ` | CATEGORY: ${input.categorySlug}` : ""}
PROPOSITION: ${prop.username}
OPPOSITION:  ${opp.username}
DEBATER A id="${input.debaterA.id}": ${input.debaterA.username}
DEBATER B id="${input.debaterB.id}": ${input.debaterB.username}

DEBATE STRUCTURE (each speaker gets one turn per phase):
  Phase 1 — Opening Constructive (3 min): Establish positions with evidence
  Phase 2 — Crossfire (1.5 min):         Direct Q&A challenge between debaters
  Phase 3 — Rebuttal (2 min):            Attack and defend; engage all major claims
  Phase 4 — Closing Summary (1 min):     Crystallise the debate; no new arguments

FULL DEBATE TRANSCRIPT:
${transcript}`;
}

/** Strip markdown code fences that some models wrap around JSON */
function stripJsonFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

/**
 * Escape literal newlines / carriage-returns that appear inside JSON string
 * values. Some models emit real \n characters inside quoted strings instead of
 * the JSON-escaped \\n sequence, which causes JSON.parse to fail.
 */
function sanitizeLiteralNewlines(s: string): string {
  let inString = false;
  let esc = false;
  let result = "";
  for (const ch of s) {
    if (esc) { result += ch; esc = false; continue; }
    if (ch === "\\" && inString) { result += ch; esc = true; continue; }
    if (ch === '"') { result += ch; inString = !inString; continue; }
    if (inString && ch === "\n") { result += "\\n"; continue; }
    if (inString && ch === "\r") { result += "\\r"; continue; }
    result += ch;
  }
  return result;
}

function tryParseJson(raw: string): Record<string, unknown> {
  const cleaned = stripJsonFences(raw);
  // Attempt 1: standard parse
  try { return JSON.parse(cleaned) as Record<string, unknown>; } catch {}
  // Attempt 2: sanitize literal newlines inside strings
  const sanitized = sanitizeLiteralNewlines(cleaned);
  try { return JSON.parse(sanitized) as Record<string, unknown>; } catch {}
  // Attempt 3: remove trailing commas before } or ]
  const noTrailing = sanitized.replace(/,(\s*[}\]])/g, "$1");
  try { return JSON.parse(noTrailing) as Record<string, unknown>; } catch {}
  // Attempt 4: regex-extract basic fields for new format fallback
  const winnerUsername = cleaned.match(/"winner_username"\s*:\s*"([^"]+)"/)?.[1] ?? null;
  const summary = cleaned.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/)?.[1]?.replace(/\\n/g, "\n") ?? "";
  if (winnerUsername) {
    return { 
      winner_username: winnerUsername, 
      public_result: { winner_username: winnerUsername, summary },
      private_assessment: { key_claim_checks: [] }
    };
  }
  throw new Error(`Failed to parse judge JSON after all attempts. Raw (first 400): ${raw.slice(0, 400)}`);
}

function parseVerdict(raw: string, input: JudgeInput): SingleJudgeVerdict {
  const parsed = tryParseJson(raw);

  // Map winner_username to winnerId
  const publicResult = parsed.public_result as Record<string, unknown> | undefined;
  const winnerUsername = parsed.winner_username ?? (publicResult?.winner_username as string | undefined);
  const winnerId: string | null = 
    winnerUsername === input.debaterA.username ? input.debaterA.id :
    winnerUsername === input.debaterB.username ? input.debaterB.id :
    input.debaterA.id; // fallback

  // Extract summary from new format
  const explanation = String((publicResult?.summary as string) ?? parsed.summary ?? "");

  // Extract evidence checks — support both old key_claim_checks and legacy format
  // "disputed" and "incorrect" kept for backward-compat display of old stored debates.
  // "unsupported" (generic) is intentionally excluded — maps to "unsupported_in_round" via fallback.
  const VALID_VERDICTS = new Set([
    "correct", "mostly_correct", "misleading", "context_dependent",
    "unsupported_in_round", "unsupported_generally",
    // legacy aliases — kept so old stored results still render
    "disputed", "incorrect",
  ]);
  const privateAssessment = parsed.private_assessment as Record<string, unknown> | undefined;
  const claimChecksRaw = Array.isArray(privateAssessment?.key_claim_checks)
    ? privateAssessment.key_claim_checks as Array<Record<string, unknown>>
    : [];
  const evidenceChecks: EvidenceCheck[] = claimChecksRaw
    .filter((e) => e && typeof e.claim === "string" && typeof e.verdict === "string")
    .map((e) => ({
      debater: String(e.username ?? ""),
      claim: String(e.claim ?? ""),
      verdict: (VALID_VERDICTS.has(String(e.verdict)) ? e.verdict : "unsupported_in_round") as EvidenceCheck["verdict"],
      explanation: String(e.reason ?? ""),
      source: typeof e.source === "string" && e.source ? e.source : undefined,
      importance: undefined,
    }));

  // Extract scores from new nested format
  const scores = privateAssessment?.scores as Record<string, unknown> | undefined;
  const scoresA = parseScoresFromNew(scores?.[input.debaterA.username]);
  const scoresB = parseScoresFromNew(scores?.[input.debaterB.username]);

  // Generate private feedback for both debaters
  const winnerReason = String(privateAssessment?.winner_reason ?? "");
  const scoresObjA = scores?.[input.debaterA.username] as Record<string, unknown> | undefined;
  const scoresObjB = scores?.[input.debaterB.username] as Record<string, unknown> | undefined;
  const isWinnerA = winnerUsername === input.debaterA.username;
  const privateFeedbackA = [
    isWinnerA ? `You won this debate. ${winnerReason}` : `You lost this debate. ${winnerReason}`,
    scoresObjA?.improvement ? `Improvement tip: ${scoresObjA.improvement}` : "",
  ].filter(Boolean).join("\n\n");
  const privateFeedbackB = [
    !isWinnerA ? `You won this debate. ${winnerReason}` : `You lost this debate. ${winnerReason}`,
    scoresObjB?.improvement ? `Improvement tip: ${scoresObjB.improvement}` : "",
  ].filter(Boolean).join("\n\n");

  return {
    winnerId,
    explanation,
    privateFeedbackA,
    privateFeedbackB,
    evidenceChecks,
    scoresA,
    scoresB,
    biggestMistakeA: undefined,
    biggestAchievementA: undefined,
    biggestMistakeB: undefined,
    biggestAchievementB: undefined,
    improvementA: undefined,
    improvementB: undefined,
  };
}

function parseScoresFromNew(raw: unknown): DebaterScores | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const r = raw as Record<string, unknown>;
  const n = (k: string, fallback = 5): number => {
    const v = r[k];
    return typeof v === "number" ? Math.max(0, Math.min(10, v)) : fallback;
  };
  const factuality = n("factuality");
  const evidence_quality = n("evidence_quality");
  const argument_strength = n("argument_strength");
  const rebuttal_quality = n("rebuttal_quality");
  const clarity = n("clarity");
  const persuasiveness = n("persuasiveness");
  
  // Compute server-side — don't trust model's arithmetic
  let final_score =
    factuality * 0.35 +
    evidence_quality * 0.25 +
    argument_strength * 0.15 +
    rebuttal_quality * 0.15 +
    clarity * 0.05 +
    persuasiveness * 0.05;
  if (factuality < 3) final_score = Math.min(final_score, 3);
  else if (factuality < 5) final_score = Math.min(final_score, 6);
  
  return {
    factuality,
    evidence_quality,
    argument_strength,
    rebuttal_quality,
    clarity,
    persuasiveness,
    final_score: Math.round(final_score * 10) / 10,
  };
}

/** Collect all chunks from a streaming chat.send() response into one string.
 * Uses Promise.race so the timeout fires even if no chunks ever arrive. */
async function collectStream(
  stream: AsyncIterable<{ choices: Array<{ delta: { content?: string | null } }> }>,
  timeoutMs = 90_000,
): Promise<string> {
  let text = "";

  const drain = async (): Promise<string> => {
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) text += content;
    }
    return text.trim();
  };

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Stream timed out after ${Math.round(timeoutMs / 1000)}s`)),
      timeoutMs,
    ),
  );

  return Promise.race([drain(), timeout]);
}

/** Retry a function up to `attempts` times with exponential backoff. */
async function withRetry<T>(
  fn: () => Promise<T>,
  { attempts = 2, delayMs = 4000 }: { attempts?: number; delayMs?: number } = {},
): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) {
        console.warn(
          `[judging] attempt ${i + 1}/${attempts} failed (retrying in ${delayMs}ms):`,
          err instanceof Error ? err.message : err,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs = Math.min(delayMs * 2, 30_000);
      }
    }
  }
  throw lastErr;
}

// ─── Judge A: Grok ─────────────────────────────────────────────────────────────

const SELF_DEFINE_PERSONA = `
==================================================
YOUR JUDGING PERSONA (SELF-DEFINED)
==================================================

You are one judge on a three-judge panel. Each judge independently brings a distinct evaluative lens to the same debate.

Before you begin scoring, establish your own unique judging persona for this session. Decide:
- What you weight most heavily among the six scoring dimensions
- What you are most sceptical of (e.g. unverified statistics, rhetorical polish, moralising without argument, technocratic detail, etc.)
- One area where you apply a notably stricter standard than a generic judge would

Apply this self-defined lens consistently throughout your analysis. Your persona should produce evaluations that are meaningfully distinct from a judge with a different emphasis.

You still apply ALL rules in the master judging prompt — ideological neutrality, comparative judging, burden symmetry, etc.
Your persona only shifts your EMPHASIS within those rules, not the rules themselves.
`;

async function buildGrokSystem(input: JudgeInput): Promise<string> {
  const master = await getMasterPrompt();
  return buildSystemPrompt(master + SELF_DEFINE_PERSONA, input);
}

export class GrokJudgingProvider implements IJudgingProvider {
  readonly name = "Grok";
  private readonly client: OpenRouter;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new OpenRouter({
      apiKey: options.apiKey,
      httpReferer: "https://arguably.app",
      appTitle: "Arguably Debate Platform",
    });
    this.model = options.model ?? "x-ai/grok-4.20";
  }

  async judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    return withRetry(() => this._judge(input));
  }

  private async _judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    const systemContent = await buildGrokSystem(input);
    const stream = await this.client.chat.send({
      chatRequest: {
        model: this.model,
        temperature: 0.5,
        maxTokens: 4000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemContent },
          {
            role: "user",
            content: buildTranscriptText(input) + "\n\nFact-check this debate and provide your verdict JSON.",
          },
        ],
        stream: true,
      },
    });

    const raw = await collectStream(stream, 90_000);
    if (!raw) throw new Error("Empty response from Grok judge");
    return parseVerdict(raw, input);
  }
}

// ─── Judge B: Claude ───────────────────────────────────────────────────────────

async function buildClaudeSystem(input: JudgeInput): Promise<string> {
  const master = await getMasterPrompt();
  return buildSystemPrompt(master + SELF_DEFINE_PERSONA, input);
}

export class ClaudeJudgingProvider implements IJudgingProvider {
  readonly name = "Claude";
  private readonly client: OpenRouter;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new OpenRouter({
      apiKey: options.apiKey,
      httpReferer: "https://arguably.app",
      appTitle: "Arguably Debate Platform",
    });
    this.model = options.model ?? "anthropic/claude-haiku-4.5";
  }

  async judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    return withRetry(() => this._judge(input));
  }

  private async _judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    const systemContent = await buildClaudeSystem(input);
    const stream = await this.client.chat.send({
      chatRequest: {
        model: this.model,
        temperature: 0.5,
        maxTokens: 4000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemContent },
          {
            role: "user",
            content: buildTranscriptText(input) + "\n\nFact-check this debate and provide your verdict JSON.",
          },
        ],
        stream: true,
      },
    });

    const raw = await collectStream(stream, 90_000);
    if (!raw) throw new Error("Empty response from Claude judge");
    return parseVerdict(raw, input);
  }
}

// ─── Judge C: GPT — The Arbiter ───────────────────────────────────────────────

async function buildArbiterSystem(input: JudgeInput): Promise<string> {
  return buildSystemPrompt(await getMasterPrompt(), input);
}
// The Arbiter intentionally has NO extra persona — its job is to meta-judge
// the two specialists above, not to add a third fixed lens to the mix.

export class ArbiterJudgingProvider implements IJudgingProvider {
  readonly name = "Arbiter (GPT)";
  private readonly client: OpenRouter;
  private readonly model: string;

  constructor(options: { apiKey: string; model?: string }) {
    this.client = new OpenRouter({
      apiKey: options.apiKey,
      httpReferer: "https://arguably.app",
      appTitle: "Arguably Debate Platform",
    });
    this.model = options.model ?? "openai/gpt-4.1-mini";
  }

  async judgeWithPriorVerdicts(
    input: JudgeInput,
    priorVerdicts: Array<{ judgeName: string; verdict: SingleJudgeVerdict }>,
  ): Promise<SingleJudgeVerdict> {
    return withRetry(() => this._judgeWithPriorVerdicts(input, priorVerdicts), { attempts: 2, delayMs: 5000 });
  }

  private async _judgeWithPriorVerdicts(
    input: JudgeInput,
    priorVerdicts: Array<{ judgeName: string; verdict: SingleJudgeVerdict }>,
  ): Promise<SingleJudgeVerdict> {
    const transcriptText = buildTranscriptText(input);

    const priorSection =
      priorVerdicts.length > 0
        ? "\n\n" +
          "=== PEER JUDGE VERDICTS (for arbitration use only) ===\n" +
          "You are the final Arbitrator. You have read the full debate above AND the two peer verdicts below.\n" +
          "Your role is to act as a genuine meta-judge, NOT to mechanically average their scores.\n\n" +
          "ARBITRATION PROCESS:\n" +
          "1. AGREEMENT: Where Grok and Claude agree on a winner, this raises confidence. Note where they agree.\n" +
          "2. DISAGREEMENT: Where they split, examine each verdict for flaws — did one judge overlook a key claim?\n" +
          "   Did one judge fall for a plausible-sounding but false assertion? Did one penalise or reward unfairly?\n" +
          "3. HALLUCINATION CHECK: Flag any claim checks from peer judges that seem fabricated, unverifiable, or\n" +
          "   inconsistent with the actual transcript. Ignore or discount those findings.\n" +
          "4. SCORING ANOMALIES: If peer scores for the same debater differ by more than 2 points on any dimension,\n" +
          "   investigate why. Apply the more accurate score, not the average.\n" +
          "5. OVERLOOKED REBUTTALS: Check if any significant argument in the transcript was missed by both peer judges.\n" +
          "   Incorporate those findings into your verdict.\n" +
          "6. FINAL DETERMINATION: Issue your own independent winner determination supported by your analysis.\n" +
          "   If peer judges agree, ordinarily follow that consensus — but you may override if their reasoning is flawed.\n\n" +
          "7. IDEOLOGICAL CONVERGENCE CHECK: Examine whether both peer judges share a systematic framing bias:\n" +
          "   - Did both judges implicitly favour utilitarian or practical arguments over rights-based/principle arguments?\n" +
          "   - Did both reward 'having a solution' over 'proving the solution is justified or valid'?\n" +
          "   - Did both penalise moral, constitutional, or deterrence-based arguments unfairly?\n" +
          "   - Did both treat empirical uncertainty inconsistently between the two debaters?\n" +
          "   If ideological convergence is detected, explicitly note it and correct for it in your determination.\n\n" +
          "8. POTENTIAL BIAS REVIEW: Before finalising your verdict, confirm:\n" +
          "   - You have NOT penalised a debater for failing to present a complete alternative system.\n" +
          "   - You have NOT treated 'opponent\'s solution is imperfect' as automatic validation of the other side.\n" +
          "   - You have used 'unsupported_in_round' (not cited here) vs 'unsupported_generally' (no real evidence) correctly.\n" +
          "   - You have given equal weight to rights-based and principle-based arguments vs practicality arguments.\n\n" +
          priorVerdicts
            .map(({ judgeName, verdict }) => {
              const winnerName =
                verdict.winnerId === input.debaterA.id
                  ? input.debaterA.username
                  : verdict.winnerId === input.debaterB.id
                    ? input.debaterB.username
                    : "Tie";
              const claimSummary = verdict.evidenceChecks
                .slice(0, 6)
                .map((e) => `    • ${e.debater} claim \"${e.claim.slice(0, 70)}...\" -> ${e.verdict}: ${e.explanation.slice(0, 80)}`)
                .join("\n");
              const scoresA = verdict.scoresA ? `factuality=${verdict.scoresA.factuality} evidence=${verdict.scoresA.evidence_quality} rebuttal=${verdict.scoresA.rebuttal_quality} final=${verdict.scoresA.final_score}` : "(no scores)";
              const scoresB = verdict.scoresB ? `factuality=${verdict.scoresB.factuality} evidence=${verdict.scoresB.evidence_quality} rebuttal=${verdict.scoresB.rebuttal_quality} final=${verdict.scoresB.final_score}` : "(no scores)";
              return (
                `--- PEER VERDICT: ${judgeName} ---\n` +
                `Winner: ${winnerName}\n` +
                `Analysis: ${verdict.explanation.slice(0, 500)}\n` +
                `Scores ${input.debaterA.username}: ${scoresA}\n` +
                `Scores ${input.debaterB.username}: ${scoresB}\n` +
                `Key claim findings:\n${claimSummary || "    (none)"}`
              );
            })
            .join("\n\n")
        : "";

    const systemContent = await buildArbiterSystem(input);
    const stream = await this.client.chat.send({
      chatRequest: {
        model: this.model,
        temperature: 0.25,
        maxTokens: 8000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemContent },
          {
            role: "user",
            content:
              transcriptText +
              priorSection +
              "\n\nNow deliver your authoritative final arbitration verdict JSON. Apply your meta-judge analysis of the peer verdicts above and issue your independent determination.",
          },
        ],
        stream: true,
      },
    });

    const raw = await collectStream(stream, 180_000); // 3 min for Arbiter
    if (!raw) throw new Error("Empty response from Arbiter judge");
    return parseVerdict(raw, input);
  }

  async judge(input: JudgeInput): Promise<SingleJudgeVerdict> {
    return this.judgeWithPriorVerdicts(input, []);
  }
}

// ─── Feedback-only regeneration ──────────────────────────────────────────────

const FEEDBACK_BLOCK_TEMPLATE = (name: string) =>
  `factuality: <integer 0-10>\nevidence_quality: <integer 0-10>\nargument_strength: <integer 0-10>\nrebuttal_quality: <integer 0-10>\nclarity: <integer 0-10>\npersuasiveness: <integer 0-10>\n\nMajor Strength: <exactly one sentence — ${name}'s single most effective argument or evidence use>\nMajor Weakness: <exactly one sentence — ${name}'s biggest factual or logical error>\n\nImprovement: <exactly one short actionable sentence — the most important thing ${name} should improve>`;

/**
 * Generates ONLY the structured private feedback for both debaters.
 * Does not re-run fact-checking or scoring; uses the debate transcript directly.
 * Returns plain-text blocks in the exact required format.
 */
export async function generateFeedbackOnly(
  input: JudgeInput,
  options: { apiKey: string; model?: string },
): Promise<{ feedbackA: string; feedbackB: string }> {
  const client = new OpenRouter({
    apiKey: options.apiKey,
    httpReferer: "https://arguably.app",
    appTitle: "Arguably Debate Platform",
  });
  const model = options.model ?? "openai/gpt-4.1-mini";
  const a = input.debaterA.username;
  const b = input.debaterB.username;

  const extraInstruction = ""; // admin master prompt handles all judging instructions

  const systemPrompt = `You are an expert debate judge providing private performance feedback.

HARD RULES:
- Output MUST be valid JSON with exactly two keys: "feedbackA" and "feedbackB"
- Each value MUST follow the EXACT format below — no extra text, no emojis, no unicode
- Scores 0-10 where factuality is the most important dimension
- If core claims are false, factuality must be 0-4 and other scores must reflect this
- Major Strength and Major Weakness must be EXACTLY ONE sentence each
- Improvement must be EXACTLY ONE short actionable sentence

REQUIRED FORMAT for each feedback value (plain text, newlines as \\n):
${FEEDBACK_BLOCK_TEMPLATE("<debater username>")}
${extraInstruction ? `\nADDITIONAL INSTRUCTION for generating feedback:\n${extraInstruction}` : ""}

Output only valid JSON — no markdown fences, no commentary.`;

  const userPrompt = `${buildTranscriptText(input)}

Now produce private feedback for both debaters.

JSON schema:
{
  "feedbackA": "${FEEDBACK_BLOCK_TEMPLATE(a).replace(/\n/g, "\\n")}",
  "feedbackB": "${FEEDBACK_BLOCK_TEMPLATE(b).replace(/\n/g, "\\n")}"
}`;

  const doRequest = async () => {
    const stream = await client.chat.send({
      chatRequest: {
        model,
        temperature: 0.3,
        maxTokens: 2000,
        responseFormat: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        stream: true,
      },
    });
    return collectStream(stream, 90_000);
  };

  const raw = await withRetry(doRequest, { attempts: 4, delayMs: 3000 });
  if (!raw) throw new Error("Empty response from feedback generator");

  const parsed = tryParseJson(raw);
  const feedbackA = typeof parsed.feedbackA === "string" ? parsed.feedbackA.trim() : "";
  const feedbackB = typeof parsed.feedbackB === "string" ? parsed.feedbackB.trim() : "";
  if (!feedbackA || !feedbackB) throw new Error("Missing feedbackA or feedbackB in response");
  return { feedbackA, feedbackB };
}

