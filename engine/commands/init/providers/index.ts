import { StaticConfig, trace, ExecutionConfig } from "../../../../common";
import * as path from "path";
import * as readdir from "readdir";
import * as _ from "lodash";
import * as fs from "fs";

interface IFileProvider {
    /*async*/ provide(): Promise<Map<string, string>>;
}

class StaticFileProvider implements IFileProvider {
    async provide(): Promise<Map<string, string>> {
        return _.reduce<string, Map<string, string>>(readdir.readSync(StaticConfig.templatePath), (result, file) => {
            return result.set(file, fs.readFileSync(path.join(StaticConfig.templatePath, file)).toString());
        }, new Map<string, string>());
    }
}

export function getFileProvider(): IFileProvider {
    return new StaticFileProvider();
}