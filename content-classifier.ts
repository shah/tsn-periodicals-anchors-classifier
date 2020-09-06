import * as m from "./flex-match";

export interface ClassifiableContent<T> {
    readonly content: T;
}

export interface ClassifiableText extends ClassifiableContent<string> {
}

export function isClassifiableContent(o: any): o is ClassifiableContent<any> {
    return o && typeof o === "object" && "content" in o;
}

export interface ClassifyContent<T, C> {
    (cc: ClassifiableContent<T>): ClassifiedContent<C>;
}

export interface ContentClassificationRule<T, C> {
    readonly match: m.FlexMatch;
    readonly classify: ClassifyContent<T, C>;
}

export interface ClassifiedContent<T> {
    readonly isClassifiedContent: true;
    readonly classification: T;
}

export function isClassifiedContent(o: any): o is ClassifiedContent<any> {
    return o && typeof o === "object" && "isClassifiedContent" in o;
}

export interface UnclassifiedContent {
    readonly isUnclassifiedContent: true;
}

export function isUnclassifiedContent(o: any): o is UnclassifiedContent {
    return o && typeof o === "object" && "isUnclassifiedContent" in o;
}

export interface ContentRuleEngineContext {
}

export interface ContentRuleEngine<T, C> {
    match(ctx: ContentRuleEngineContext): ContentClassificationRule<T, C> | undefined;
}

export interface ContentClassifierContext {
}

export interface ContentClassifier<T, C, U> {
    classify(ctx: ContentClassifierContext): ClassifiedContent<C> | UnclassifiedContent;
}
