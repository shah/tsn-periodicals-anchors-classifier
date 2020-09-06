import * as p from "@shah/ts-pipe";
import * as fs from "fs";
import * as path from "path";
import { v5 as uuid } from "uuid";
import * as atc from "./anchor-text-classifier";
import * as cc from "./content-classifier";
import * as fm from "./flex-match";

// TODO: classify duplicates and add ability to handle duplicates
// TODO: consider creating a persistence adapter for Microsoft TODO / OpenProject

export type ClassifiedAnchorText = atc.ClassifiedAnchorText<any> | atc.UnclassifiedAnchorText;

// a URL that is found in the content of a periodical
export interface UniformResourceLocation {
    readonly href: string;
}

// Structurally, HtmlAnchor should be identical to @shah/queryable-content:HtmlAnchor
// so that anchors from @shah/queryable-content can be used but @shah/queryable-content
// does not need to be a dependency
export interface HtmlAnchor extends UniformResourceLocation {
    readonly label?: string;
}

export interface PeriodicalAnchor {
    readonly isPeriodicalAnchor: true,
    readonly anchorText: string;
    count: number;
}

export function isPeriodicalAnchor(o: any): o is PeriodicalAnchor {
    return o && "isPeriodicalAnchor" in o;
}

export interface ClassifiedPeriodicalAnchor extends PeriodicalAnchor {
    readonly isClassifiedPeriodicalAnchor: true,
    readonly classification: ClassifiedAnchorText;
    readonly count: number;
}

export function isClassifiedPeriodicalAnchor(o: any): o is ClassifiedPeriodicalAnchor {
    return o && "ClassifiedPeriodicalAnchor" in o;
}

export interface PeriodicalSuppliers {
    [name: string]: PeriodicalSupplier;
}

export interface PeriodicalSupplier {
    readonly name: string;
    readonly periodicals: { [name: string]: Periodical };
    registerPeriodical(name: string): Periodical;
    classifyAnchors(): Promise<void>;
}

export interface PeriodicalCommonAnchor extends ClassifiedPeriodicalAnchor {
    readonly isPeriodicalCommonAnchor: true;
}

export function isPeriodicalCommonAnchor(o: ClassifiedPeriodicalAnchor): o is PeriodicalCommonAnchor {
    return "isPeriodicalCommonAnchor" in o;
}

export interface Periodical {
    readonly name: string;
    readonly editions: PeriodicalEdition[];
    readonly classifiedAnchors: { [anchorText: string]: ClassifiedPeriodicalAnchor };
    registerEdition(edition: PeriodicalEdition): PeriodicalEdition;
    registerAnchor(anchor: HtmlAnchor): ClassifiedAnchor;
    classifyAnchorText(anchorText: string): ClassifiedAnchorText;
    classifyAnchors(): Promise<void>;
}

export interface ClassifiedAnchor extends HtmlAnchor {
    readonly classifierText: string;
    readonly classifiedBy?: ClassifiedPeriodicalAnchor;
    readonly classification: ClassifiedAnchorText;
}

export interface PeriodicalEdition {
    readonly supplierContentId: string;
    readonly fromAddress: string;
    readonly fromName: string;
    readonly date: Date;
    readonly anchors: ClassifiedAnchor[];
}

export class TypicalPeriodicalSupplier implements PeriodicalSupplier {
    readonly periodicals: { [name: string]: Periodical } = {};

    constructor(
        readonly name: string,
        readonly atcRulesEngine: atc.AnchorTextRuleEngine,
        readonly atcClassifier: atc.AnchorTextClassifier) {
    }

    registerPeriodical(periodicalName: string): Periodical {
        let result = this.periodicals[periodicalName];
        if (!result) {
            result = new TypicalPeriodical(periodicalName, this.atcRulesEngine, this.atcClassifier);
            this.periodicals[periodicalName] = result;
        }
        return result;
    }

    async classifyAnchors(): Promise<void> {
        for (const p of Object.values(this.periodicals)) {
            await p.classifyAnchors();
        }
    }
}

export class TypicalPeriodical implements Periodical {
    readonly editions: PeriodicalEdition[] = [];
    protected readonly unclassifiedAnchors: { [anchorText: string]: PeriodicalAnchor } = {};
    readonly classifiedAnchors: { [anchorText: string]: ClassifiedPeriodicalAnchor } = {};
    readonly nameMatcher: fm.FlexMatch;

    constructor(readonly name: string,
        readonly atcRulesEngine: atc.AnchorTextRuleEngine,
        readonly atcClassifier: atc.AnchorTextClassifier) {
        this.nameMatcher = fm.exactMatch(this.name);
    }

    protected classifierAnchorText(anchor: HtmlAnchor): string {
        return anchor.label ? anchor.label.replace(/(\r\n|\n|\r|\t)/gm, " ").trim().toLocaleLowerCase() : "";
    }

    classifyAnchorText(anchorText: string): ClassifiedAnchorText {
        const context: atc.AnchorTextClassifierContext = {
            anchorText: anchorText,
            engine: this.atcRulesEngine,
            periodicalName: this.nameMatcher,
        }
        return this.atcClassifier.classify(context);
    }

    registerEdition(edition: PeriodicalEdition): PeriodicalEdition {
        this.editions.push(edition);
        return edition;
    }

    registerAnchor(anchor: HtmlAnchor): ClassifiedAnchor {
        const classifierAnchorText = this.classifierAnchorText(anchor);
        if (classifierAnchorText.length > 0) {
            const aa = this.unclassifiedAnchors[classifierAnchorText];
            if (aa) {
                aa.count++;
            } else {
                this.unclassifiedAnchors[classifierAnchorText] = {
                    isPeriodicalAnchor: true,
                    anchorText: classifierAnchorText,
                    count: 1,
                }
            }
        }
        return {
            ...anchor,
            classifierText: classifierAnchorText,
            classification: atc.unclassifiedAnchorText(classifierAnchorText)
        };
    }

    async classifyAnchors(): Promise<void> {
        for (const ua of Object.values(this.unclassifiedAnchors)) {
            const classification = this.classifyAnchorText(ua.anchorText);
            let classified: ClassifiedPeriodicalAnchor | PeriodicalCommonAnchor = {
                ...ua,
                isClassifiedPeriodicalAnchor: true,
                classification: classification
            };
            if (classified.count > 1 && classified.count == this.editions.length) {
                classified = {
                    isPeriodicalCommonAnchor: true,
                    ...classified,
                }
            }
            this.classifiedAnchors[classified.anchorText] = classified;
        }
        for (const pe of this.editions) {
            pe.anchors.forEach(async (ca, index, array) => {
                const periodicalAnchor = this.classifiedAnchors[ca.classifierText];
                if (periodicalAnchor && cc.isClassifiedContent(periodicalAnchor.classification)) {
                    array[index] = {
                        ...ca,
                        classifiedBy: periodicalAnchor,
                        classification: periodicalAnchor.classification
                    };
                } else {
                    const classification = this.classifyAnchorText(ca.classifierText);
                    array[index] = {
                        ...ca,
                        classification: classification
                    };
                }
            })
        }
    }
}

export type UUID = string;

export interface PersistProperties {
    [name: string]: any;
}

export interface PersistPropsTransformContext<T> {
    readonly persist: PersistProperties;
    readonly source: T;
}

export interface PersistPropsTransformer extends p.PipeUnionSync<PersistPropsTransformContext<any>, PersistProperties> {
}

export interface TabularColumnDefn {
    delimitedHeader(): string;
    delimitedContent(pp: PersistProperties): string;
}

export class GuessColumnDefn {
    constructor(readonly name: string, readonly guessedFrom: PersistProperties) {
    }

    delimitedHeader(): string {
        return this.name;
    }

    delimitedContent(pp: PersistProperties): string {
        const value = pp[this.name];
        return this.name == "id" || this.name.endsWith("_id")
            ? value
            : JSON.stringify(value);
    }
}

export interface TabularWriterOptions<T> {
    readonly destPath: string;
    readonly fileName: string;
    readonly parentUuidNamespace: string;
    readonly ppTransform?: PersistPropsTransformer;
    readonly schema?: TabularColumnDefn[];
}

export class TabularWriter<T> {
    readonly columnDelim = ",";
    readonly recordDelim = "\n";
    readonly destPath: string;
    readonly fileName: string;
    readonly pkNamespace: UUID;
    readonly schema: TabularColumnDefn[];
    readonly ppTransform?: PersistPropsTransformer;
    readonly csvStream: fs.WriteStream;
    protected rowIndex: number = 0;

    constructor({ destPath, fileName, parentUuidNamespace, ppTransform, schema }: TabularWriterOptions<T>) {
        this.destPath = destPath;
        this.fileName = fileName;
        this.csvStream = fs.createWriteStream(path.join(destPath, fileName));
        this.schema = schema || [];
        this.ppTransform = ppTransform;
        this.pkNamespace = uuid(fileName, parentUuidNamespace);
    }

    createId(name: string): UUID {
        return uuid(name, this.pkNamespace);
    }

    close(): void {
        this.csvStream.close();
    }

    guessSchema(guessFrom: PersistProperties): void {
        if (this.schema.length == 0) {
            for (const name of Object.keys(guessFrom)) {
                this.schema.push(new GuessColumnDefn(name, guessFrom));
            }
        }
    }

    writeDelimitedHeader(guess: PersistProperties): void {
        this.guessSchema(guess);
        const headers: string[] = [];
        for (const column of this.schema) {
            headers.push(column.delimitedHeader());
        }
        this.csvStream.write(headers.join(this.columnDelim));
    }

    write(ctx: PersistPropsTransformContext<T>): boolean {
        let persist = ctx.persist;
        if (this.ppTransform) {
            persist = this.ppTransform.flow(ctx, persist);
        }
        if (persist) {
            if (this.rowIndex == 0) {
                this.writeDelimitedHeader(persist);
            }
            const content: string[] = [];
            for (const column of this.schema) {
                content.push(column.delimitedContent(persist));
            }
            this.csvStream.write(this.recordDelim);
            this.csvStream.write(content.join(this.columnDelim));
            this.rowIndex++;
            return true;
        }
        return false;
    }
}

export interface RelationalCsvTableNames {
    readonly suppliers: string;
    readonly periodicals: string;
    readonly periodicalAnchors: string;
    readonly periodicalCommonAnchors: string;
    readonly periodicalEditions: string;
    readonly editionAnchors: string;
}

export interface RelationalCsvTableWriters {
    readonly names: RelationalCsvTableNames,
    readonly suppliers: TabularWriter<PeriodicalSupplier>;
    readonly periodicals: TabularWriter<Periodical>;
    readonly periodicalAnchors: TabularWriter<PeriodicalAnchor>;
    readonly periodicalCommonAnchors: TabularWriter<PeriodicalAnchor>;
    readonly periodicalEditions: TabularWriter<PeriodicalEdition>;
    readonly editionAnchors: TabularWriter<ClassifiedAnchor>;
    close(): void;
}

export class DefaultRelationalCsvTableWriters implements RelationalCsvTableWriters {
    static readonly UUID_NAMESPACE: UUID = "3438161e-47a2-415d-8fc8-ae8ed80a7c86";
    static readonly NAMES: RelationalCsvTableNames = {
        suppliers: "suppliers.csv",
        periodicals: "periodicals.csv",
        periodicalAnchors: "periodical-anchors.csv",
        periodicalCommonAnchors: "periodical-anchors-common.csv",
        periodicalEditions: "periodical-editions.csv",
        editionAnchors: "periodical-edition-anchors.csv"
    }

    readonly names: RelationalCsvTableNames;
    readonly suppliers: TabularWriter<PeriodicalSupplier>;
    readonly periodicals: TabularWriter<Periodical>;
    readonly periodicalAnchors: TabularWriter<PeriodicalAnchor>;
    readonly periodicalCommonAnchors: TabularWriter<PeriodicalAnchor>;
    readonly periodicalEditions: TabularWriter<PeriodicalEdition>;
    readonly editionAnchors: TabularWriter<ClassifiedAnchor>;

    constructor(destPath: string, uuidNamespace = DefaultRelationalCsvTableWriters.UUID_NAMESPACE, writers?: Partial<RelationalCsvTableWriters>) {
        this.names = writers?.names || DefaultRelationalCsvTableWriters.NAMES;
        this.suppliers = writers?.suppliers || new TabularWriter({ destPath, fileName: this.names.suppliers, parentUuidNamespace: uuidNamespace });
        this.periodicals = writers?.periodicals || new TabularWriter({ destPath, fileName: this.names.periodicals, parentUuidNamespace: uuidNamespace });
        this.periodicalAnchors = writers?.periodicalAnchors || new TabularWriter({ destPath, fileName: this.names.periodicalAnchors, parentUuidNamespace: uuidNamespace });
        this.periodicalCommonAnchors = writers?.periodicalCommonAnchors || new TabularWriter({ destPath, fileName: this.names.periodicalCommonAnchors, parentUuidNamespace: uuidNamespace });
        this.periodicalEditions = writers?.periodicalEditions || new TabularWriter({ destPath, fileName: this.names.periodicalEditions, parentUuidNamespace: uuidNamespace });
        this.editionAnchors = writers?.editionAnchors || new TabularWriter({ destPath, fileName: this.names.editionAnchors, parentUuidNamespace: uuidNamespace });
    }

    close(): void {
        this.editionAnchors.close();
        this.periodicalEditions.close();
        this.periodicalCommonAnchors.close();
        this.periodicalAnchors.close();
        this.periodicals.close();
        this.suppliers.close();
    }

    static recreateDir(destPath: string): void {
        fs.rmdirSync(destPath, { recursive: true })
        fs.mkdirSync(destPath, { recursive: true });
    }

    static mkDir(destPath: string): void {
        if (!fs.existsSync(destPath)) {
            fs.mkdirSync(destPath, { recursive: true });
        }
    }
}

export class PersistRelationalCSV {
    readonly stats = {
        written: {
            suppliers: 0,
            periodicals: 0,
            periodicalAnchors: 0,
            periodicalEditions: 0,
            editionAnchors: 0,
        }
    }

    constructor(readonly writers: RelationalCsvTableWriters) {
    }

    persistSuppliers(suppliers: PeriodicalSuppliers): void {
        for (const supplier of Object.values(suppliers).sort((left, right) => { return left.name.localeCompare(right.name) })) {
            this.persistSupplier(supplier);
        }
    }

    persistSupplier(supplier: PeriodicalSupplier): UUID | undefined {
        const suppliersPK = this.writers.suppliers.createId(supplier.name);
        if (this.writers.suppliers.write({
            persist: { id: suppliersPK, name: supplier.name, periodicals: Object.keys(supplier.periodicals).length },
            source: supplier
        })) {
            this.stats.written.suppliers++;
            // sort entries so that repeated runs create the same order (and diff'ing is easier)
            for (const p of Object.values(supplier.periodicals).sort((left, right) => { return left.name.localeCompare(right.name) })) {
                this.persistPeriodical(suppliersPK, p);
            }
            return suppliersPK;
        }
        return undefined;
    }

    persistPeriodical(suppliersPK: string, p: Periodical): UUID | undefined {
        const periodicalsPK = this.writers.periodicals.createId(p.name);
        if (this.writers.periodicals.write({
            persist: { id: periodicalsPK, supplier_id: suppliersPK, name: p.name, editions: p.editions.length },
            source: p
        })) {
            this.stats.written.periodicals++;
            this.persistAnchors(suppliersPK, periodicalsPK, p);
            return periodicalsPK;
        }
        return undefined;
    }

    persistAnchors(suppliersPK: string, periodicalsPK: string, p: Periodical): void {
        // sort entries by anchor text so that repeated runs create the same order (and diff'ing is easier)
        for (const cea of Object.values(p.classifiedAnchors).sort((left, right) => { return left.anchorText.localeCompare(right.anchorText); })) {
            const periodicalAnchorPK = this.writers.periodicalAnchors.createId(periodicalsPK + cea.anchorText + cea.classification);
            const record = {
                persist: {
                    id: periodicalAnchorPK,
                    periodical_id: periodicalsPK,
                    periodical_name: p.name,
                    anchor_text_classified: cea.anchorText,
                    anchors_count: cea.count,
                    editions_count: p.editions.length,
                    classification: cea.classification.classificationID,
                    common_anchor: isPeriodicalCommonAnchor(cea) ? 1 : 0,
                }, source: cea
            };
            if (this.writers.periodicalAnchors.write(record)) {
                this.stats.written.periodicalAnchors++;
                if (isPeriodicalCommonAnchor(cea)) {
                    delete record.persist.common_anchor;
                    this.writers.periodicalCommonAnchors.write(record);
                }
            }
        }

        // sort by oldest edition first so that the newest goes to the end (for future diff'ing ease)
        for (const pe of p.editions.sort((left, right) => { return right.date.valueOf() - left.date.valueOf(); })) {
            const periodicalEditionsPK = this.writers.periodicalEditions.createId(suppliersPK + pe.supplierContentId);
            if (this.writers.periodicalEditions.write({
                persist: {
                    id: periodicalEditionsPK,
                    periodical_id: periodicalsPK,
                    supplier_content_id: pe.supplierContentId,
                    periodical_name: p.name,
                    from_address: pe.fromAddress,
                    from_name: pe.fromName,
                    date: pe.date.toISOString(),
                    anchors: pe.anchors.length,
                }, source: pe
            })) {
                this.stats.written.periodicalEditions++;
                pe.anchors.sort((left, right) => {
                    const ctCompare = left.classifierText.localeCompare(right.classifierText);
                    return ctCompare == 0 ? (left.href.localeCompare(right.href)) : ctCompare;
                }).forEach((ca) => {
                    const peAnchorsPK = this.writers.editionAnchors.createId(periodicalEditionsPK + ca.classifierText + ca.href);
                    if (this.writers.editionAnchors.write({
                        persist: {
                            id: peAnchorsPK,
                            edition_id: periodicalEditionsPK,
                            periodical_name: p.name,
                            date: pe.date.toISOString(),
                            classification: ca.classification.classificationID,
                            anchor_text_classified: ca.classifierText,
                            common_anchor: ca.classifiedBy ? (isPeriodicalCommonAnchor(ca.classifiedBy) ? 1 : 0) : 0,
                            href: ca.href,
                        }, source: ca
                    })) {
                        this.stats.written.editionAnchors++;
                    }
                });
            }
        }
    }
}
