import * as m from "./flex-match";
import * as cc from "./content-classifier";

export interface ClassifiableAnchorText extends cc.ClassifiableText {
}

export interface ClassifiedAnchorText<C> extends ClassifiableAnchorText, cc.ClassifiedContent<C> {
    readonly classificationID: string;
    readonly matchedRule: AnchorTextClassificationRule<C>;
}

export function isClassifiedAnchorText(o: any): o is ClassifiedAnchorText<any> {
    return cc.isClassifiableContent(o) && "matchedRule" in o;
}

export const UnclassifiedRuleCode = "unclassified" as const;

export interface UnclassifiedAnchorText extends ClassifiableAnchorText, cc.UnclassifiedContent {
    readonly classificationID: string;
    readonly classification: typeof UnclassifiedRuleCode;
}

export function unclassifiedAnchorText(content: string): UnclassifiedAnchorText {
    return {
        isUnclassifiedContent: true,
        content: content,
        classification: UnclassifiedRuleCode,
        classificationID: UnclassifiedRuleCode
    }
};

export interface AnchorTextClassificationRule<C> extends cc.ContentClassificationRule<string, C> {
    readonly classify: (cc: ClassifiableAnchorText) => ClassifiedAnchorText<C>;
    readonly periodicalName: m.FlexMatch;
    readonly provenance: "rule" | "common";
    readonly modifiers?: string[];
}

export interface RuleOptions {
    readonly periodicalName?: m.FlexMatch;
    readonly provenance?: "rule" | "common";
    readonly modifiers?: string[];
}

export function classificationRuleID(rule: AnchorTextClassificationRule<any>, ctype: string): string {
    const components = [rule.provenance, ctype];
    if (rule.modifiers) components.push(...rule.modifiers);
    return components.join(" ");
}

export const SideEffectRuleCode = "side-effect" as const;
export const ContentRuleCode = "content" as const;
export const NonContentRuleCode = "non-content" as const;
export const BlankTextRuleCode = "blank-text" as const;

export function isSideEffect(o: ClassifiedAnchorText<any> | UnclassifiedAnchorText): o is ClassifiedAnchorText<any> {
    return o.classification === SideEffectRuleCode;
}

export function sideEffectRule(match: m.FlexMatch, options?: RuleOptions): AnchorTextClassificationRule<typeof SideEffectRuleCode> {
    const rule = {
        match: match,
        periodicalName: options?.periodicalName || m.matchAny(),
        classify: (cc: ClassifiableAnchorText): ClassifiedAnchorText<typeof SideEffectRuleCode> => {
            return {
                ...cc,
                isClassifiedContent: true,
                matchedRule: rule,
                classification: SideEffectRuleCode,
                classificationID: classificationRuleID(rule, SideEffectRuleCode),
            }
        },
        provenance: options?.provenance || "common",
        modifiers: options?.modifiers
    }
    return rule;
}

export function isContent(o: ClassifiedAnchorText<any> | UnclassifiedAnchorText): o is ClassifiedAnchorText<any> {
    return o.classification === ContentRuleCode;
}

export function contentRule(match: m.FlexMatch, options?: RuleOptions): AnchorTextClassificationRule<typeof ContentRuleCode> {
    const rule = {
        ID: (): string => { return classificationRuleID(rule, SideEffectRuleCode) },
        match: match,
        periodicalName: options?.periodicalName || m.matchAny(),
        classify: (cc: ClassifiableAnchorText): ClassifiedAnchorText<typeof ContentRuleCode> => {
            return {
                ...cc,
                isClassifiedContent: true,
                matchedRule: rule,
                classification: ContentRuleCode,
                classificationID: classificationRuleID(rule, ContentRuleCode),
            }
        },
        provenance: options?.provenance || "common",
        modifiers: options?.modifiers
    }
    return rule;
}

export function isNotContent(o: ClassifiedAnchorText<any> | UnclassifiedAnchorText): o is ClassifiedAnchorText<any> {
    return o.classification === NonContentRuleCode;
}

export function nonContentRule(match: m.FlexMatch, options?: RuleOptions): AnchorTextClassificationRule<typeof NonContentRuleCode> {
    const rule = {
        ID: (): string => { return classificationRuleID(rule, SideEffectRuleCode) },
        match: match,
        periodicalName: options?.periodicalName || m.matchAny(),
        classify: (cc: ClassifiableAnchorText): ClassifiedAnchorText<typeof NonContentRuleCode> => {
            return {
                ...cc,
                isClassifiedContent: true,
                matchedRule: rule,
                classification: NonContentRuleCode,
                classificationID: classificationRuleID(rule, NonContentRuleCode),
            }
        },
        provenance: options?.provenance || "common",
        modifiers: options?.modifiers
    }
    return rule;
}

export function isBlankText(o: ClassifiedAnchorText<any> | UnclassifiedAnchorText): o is ClassifiedAnchorText<any> {
    return o.classification === BlankTextRuleCode;
}

export function blankTextRule(options?: RuleOptions): AnchorTextClassificationRule<typeof BlankTextRuleCode> {
    const rule = {
        ID: (): string => { return classificationRuleID(rule, SideEffectRuleCode) },
        match: {
            textMatches: (compare: string): boolean => {
                return compare.length == 0
            }
        },
        periodicalName: options?.periodicalName || m.matchAny(),
        classify: (cc: ClassifiableAnchorText): ClassifiedAnchorText<typeof BlankTextRuleCode> => {
            return {
                ...cc,
                isClassifiedContent: true,
                matchedRule: rule,
                classification: BlankTextRuleCode,
                classificationID: classificationRuleID(rule, BlankTextRuleCode),
            }
        },
        provenance: options?.provenance || "common",
        modifiers: options?.modifiers
    }
    return rule;
}

export interface AnchorTextRuleEngineContext extends cc.ContentRuleEngineContext {
    readonly anchorText: string;
    readonly periodicalName: m.FlexMatch;
}

export interface AnchorTextRuleEngine extends cc.ContentRuleEngine<string, any> {
    match(ctx: AnchorTextRuleEngineContext): AnchorTextClassificationRule<any> | undefined;
}

export interface AnchorTextClassifierContext extends cc.ContentClassifierContext, AnchorTextRuleEngineContext {
    readonly engine: AnchorTextRuleEngine;
    readonly suggested?: AnchorTextClassificationRule<any>;
}

export interface AnchorTextClassifier extends cc.ContentClassifier<any> {
    classify(ctx: AnchorTextClassifierContext): ClassifiedAnchorText<any> | UnclassifiedAnchorText;
}

export class TypicalAnchorTextRuleEngine implements AnchorTextRuleEngine {
    readonly atcRules: AnchorTextClassificationRule<any>[];

    constructor(...atcRules: AnchorTextClassificationRule<any>[][]) {
        this.atcRules = [];
        for (const r of atcRules) {
            this.atcRules.push(...r);
        }
    }

    match(ctx: AnchorTextRuleEngineContext): AnchorTextClassificationRule<any> | undefined {
        for (const rule of this.atcRules) {
            if (rule.periodicalName.flexMatches) {
                if (rule.periodicalName.flexMatches(ctx.periodicalName)) {
                    if (rule.match.textMatches(ctx.anchorText)) {
                        return rule;
                    }
                }
            } else {
                console.error("periodicalName must have a flexMatches() method");
            }
        }
        return undefined;
    }
};

export class TypicalAnchorTextClassifier implements AnchorTextClassifier {
    static readonly singleton = new TypicalAnchorTextClassifier();

    classify(ctx: AnchorTextClassifierContext): ClassifiedAnchorText<any> | UnclassifiedAnchorText {
        const matched = ctx.engine.match(ctx);
        if (matched) {
            const classifiable: ClassifiableAnchorText = {
                content: ctx.anchorText
            }
            return matched.classify(classifiable);
        }
        return unclassifiedAnchorText(ctx.anchorText);
    }
};
