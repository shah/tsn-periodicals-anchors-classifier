import * as m from "../flex-match";
import * as atc from "./anchor-text-classifier";

export const statPeriodicalNames = [
    "\"STAT: Daily Recap\" <newsletter@statnews.com>",
    "\"STAT: Morning Rounds\" <newsletter@statnews.com>",
    "STAT <marketing@statnews.com>",
    "STAT <newsletter@statnews.com>",
    "STAT <newsletters@statnews.com>",
    "STAT | Daily Recap <newsletter@statnews.com>",
    "STAT | Morning Rounds <newsletter@statnews.com>",
    "STAT: Daily Recap <newsletter@statnews.com>",
    "STAT: Morning Rounds <newsletter@statnews.com>"
];

export const statPeriodicalMatch = m.exactMatchOneOf(...statPeriodicalNames);

export const statRules: atc.AnchorTextClassificationRule<any>[] = [
    atc.nonContentRule(
        m.exactMatchOneOf("inside stat", "stat", "stat plus", "www.statnews.com"), {
        periodicalName: statPeriodicalMatch,
        provenance: "rule",
        modifiers: ["periodical:stat"]
    }),
];
