import * as atc from "./anchor-text-classifier";
import * as healthcareScene from "./periodical-healthcarescene";
import * as stat from "./periodical-stat";
import * as common from "./periodicals-common";

export class HealthScienceTechAnchorTextRuleEngine extends atc.TypicalAnchorTextRuleEngine {
    static readonly singleton = new HealthScienceTechAnchorTextRuleEngine();

    constructor() {
        // we add periodical-specific rules first so that periodicals can override common
        super(stat.statRules, healthcareScene.healthcareSceneRules, common.commonRules);
    }
}

