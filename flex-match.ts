export interface FlexMatch {
    textMatches: (compare: string) => boolean;
    flexMatches?: (compare: FlexMatch) => boolean;
}

export interface TextMatcher extends FlexMatch {
    readonly isTextMatcher: true;
    readonly options: string | string[];
}

export function isTextMatcher(o: FlexMatch): o is TextMatcher {
    return "isTextMatcher" in o;
}

export function matchAny(): FlexMatch {
    return {
        textMatches: (compare: string): boolean => {
            return true;
        },
        flexMatches: (compare: FlexMatch): boolean => {
            return true;
        }
    }
}

export function exactMatch(text: string): TextMatcher {
    return {
        isTextMatcher: true,
        options: text,
        textMatches: (compare: string): boolean => {
            return compare == text;
        },
        flexMatches: (compare: FlexMatch): boolean => {
            return compare.textMatches(text);
        }
    }
}

export function startsWith(text: string): TextMatcher {
    return {
        isTextMatcher: true,
        options: text,
        textMatches: (compare: string): boolean => {
            return compare.startsWith(text);
        },
        flexMatches: (compare: FlexMatch): boolean => {
            if (isTextMatcher(compare)) {
                if (Array.isArray(compare.options)) {
                    return compare.options.find(o => o.startsWith(text)) ? true : false;
                } else if (typeof compare.options === "string") {
                    return compare.options.startsWith(text);
                } else {
                    console.error("[flexMatch.startsWith] isTextMatcher assertion failed, options should be either string or string[].")
                }
            }
            if (isRegExpMatcher(compare)) {
                console.error(`[flexMatch.startsWith] Cannot test '${text}' with a regular expression.`);
            }
            console.error("[flexMatch.startsWith] Assertion failed, unable to handle condition.");
            return false;
        }
    }
}

export function exactMatchOneOf(...options: string[]): TextMatcher {
    return {
        isTextMatcher: true,
        options: options,
        textMatches: (compare: string): boolean => {
            return options.find(o => compare == o) ? true : false;
        },
        flexMatches: (compare: FlexMatch): boolean => {
            return options.find(o => compare.textMatches(o)) ? true : false;
        }
    }
}

export interface RegExpMatcher extends FlexMatch {
    readonly isRegExpMatcher: true;
    readonly regExp: RegExp;
}

export function isRegExpMatcher(o: FlexMatch): o is RegExpMatcher {
    return "isRegExpMatcher" in o;
}

export function regExpMatch(re: RegExp): RegExpMatcher {
    return {
        isRegExpMatcher: true,
        regExp: re,
        textMatches: (compare: string): boolean => {
            return re.test(compare);
        },
        flexMatches: (compare: FlexMatch): boolean => {
            if (isTextMatcher(compare)) {
                if (Array.isArray(compare.options)) {
                    return compare.options.find(o => re.test(o)) ? true : false;
                } else if (typeof compare.options === "string") {
                    return re.test(compare.options);
                } else {
                    console.error("[flexMatch.regExpMatch] isTextMatcher assertion failed, options should be either string or string[].")
                }
            }
            if (isRegExpMatcher(compare)) {
                console.error(`[flexMatch.regExpMatch] cannot compare regular expression '${compare.regExp}' with another regular expression.`);
            }
            console.error("[flexMatch.regExpMatch] Assertion failed, unable to handle condition.");
            return false;
        }
    }
}
