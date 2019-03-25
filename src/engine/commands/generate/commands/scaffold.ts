import * as yargs from "yargs";
import * as fs from "fs-extra";
import * as yaml from "js-yaml";

import * as changeCase from "change-case";
import * as _ from "lodash";
import { Context } from "../../../../common/context";
import { translations } from "../../../../common/translations";
import { Interactive } from "../../../../common/interactive";
import { writeFs } from "../../../../common/memfs";

const pluralize = require("pluralize");
const { generateScreen } = require("@8base/generators");
const { exportTables } = require("@8base/api-client");
const { createQueryColumnsList } = require("@8base/utils");


type ViewCommanConfig = {
  tableName: string,
  depth: number,
};

type Screen = {
  tableName: string,
  screenName: string,
  tableFields?: string[],
  formFields?: string[],
};

type EightBaseConfig = {
  appName: string
};


const promptColumns = async (columns: string[], message: string): Promise<string[]> => {
  const result = await Interactive.ask({
    name: "columns",
    type: "multiselect",
    message: message,
    choices: columns.map(column => {
      return {
        title: column,
        value: column,
      };
    })
  });

  return result.columns;
};

const getTable = (tables: Object[], tableName: string): any => {
  const table = tables.find(
    ({ name, displayName }: any) => tableName === name || tableName === displayName
  );

  if (!table) { throw new Error(translations.i18n.t("scaffold_table_error", { tableName })); }

  return table;
};

const getColumnsNames = (params: { withMeta: boolean } & ViewCommanConfig, tables: Object[]): string[] => {
  const { name } = getTable(tables, params.tableName);

  const columns = createQueryColumnsList(
    tables,
    name,
    { deep: params.depth, withMeta: params.withMeta }
  );

  const columnsNames = columns.map(({ name }: any) => name);

  return columnsNames;
};


const createTemplateFs = async (
  tables: Object[],
  screen: Screen,
  config: Object,
  context: Context,
) => {

  const rootFile = await fs.readFile("src/Root.js", "utf8");

  const fsObject = generateScreen(
    {
      tablesList: tables,
      screen,
      rootFile,
    },
    { ...config, withMeta: true },
  );

  try {
    if (fs.existsSync(Object.keys(fsObject)[0])) {
      throw new Error(translations.i18n.t("scaffold_crud_exist_error"));
    }

    await writeFs(fsObject);

    Object.keys(fsObject).forEach(filePath => context.logger.info(filePath));
    context.logger.info(context.i18n.t("scaffold_successfully_created", { screenName: screen.screenName }));
  } catch( err ) {
    context.logger.error(err);
    context.logger.error(context.i18n.t("scaffold_was_not_created", { screenName: screen.screenName }));
  }
};


export default {
  command: "scaffold <tableName>",
  describe: translations.i18n.t("scaffold_describe"),
  handler: async (params: ViewCommanConfig, context: Context) => {
    context.spinner.start("Fetching table data");
    const tables: any[] = await exportTables(context.request.bind(context), { withSystemTables: true });
    const { name } = getTable(tables, params.tableName);

    context.spinner.stop();

    let eightBaseConfig: EightBaseConfig;
    try {
      eightBaseConfig = <any>yaml.safeLoad(await fs.readFile(".8base.yml", "utf8"));
    } catch(err) {
      if (err.code === "ENOENT") {
        throw new Error(translations.i18n.t("scaffold_project_file_error", { projectFileName: ".8base.yml" }));
      } else {
        throw err;
      }
    }

    const { appName } = eightBaseConfig;
    if (!appName) throw new Error(translations.i18n.t("scaffold_project_name_error", { projectFileName: ".8base.yml" }));

    const columnsTableNames = getColumnsNames({ ...params, withMeta: true }, tables);
    const tableFields = await promptColumns(columnsTableNames, "Choose table fields");

    const columnsformNames = getColumnsNames({ ...params, withMeta: false, depth: 1 }, tables);
    const formFields = await promptColumns(columnsformNames, "Choose form fields");

    const generatorScreen = {
      screenName: name,
      tableName: name,
      formFields: formFields || [],
      tableFields: tableFields || [],
    };

    const generatorConfig = {
      depth: params.depth,
    };

    await createTemplateFs(tables, generatorScreen, generatorConfig, context);
  },
  builder: (args: yargs.Argv): yargs.Argv => {
    return args
      .usage(translations.i18n.t("scaffold_usage"))
      .option("depth", {
        describe: translations.i18n.t("scaffold_depth_describe"),
        type: "number",
        default: 1,
      });
  }
};