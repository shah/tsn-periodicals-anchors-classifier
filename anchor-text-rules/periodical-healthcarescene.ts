import * as m from "../flex-match";
import * as atc from "./anchor-text-classifier";

export const healthcareScenePeriodicalNames = [
    "Colin Hung <colin@hitmc.com>",
    "Healthcare IT Today <News@healthcareittoday.com>",
];

export const healthcareScenePeriodicalMatch = m.exactMatchOneOf(...healthcareScenePeriodicalNames);

export const healthcareSceneRules: atc.AnchorTextClassificationRule<any>[] = [
    atc.nonContentRule(
        m.exactMatchOneOf("www.healthcarescene.com"), {
        periodicalName: healthcareScenePeriodicalMatch,
        provenance: "rule",
        modifiers: ["periodical:healthcarescene"]
    }),
];
