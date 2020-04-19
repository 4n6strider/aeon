import { ProviderDatum } from 'main/providers/types';

/**
 * Maps an object that is written as { key: value } to an object that is written
 * as { key: key, value: value }[].
 * @param obj 
 */
function mapObjectToKeyValue(obj: { [key: string]: any }): { key: any, value: any }[] {
    return Object.keys(obj).map(key => ({
        key,
        value: obj[key],
    }));
}

/**
 * A transformer that can be used in the schema builder to transform keyed
 * object to array with key and value keys.
 * @param obj 
 */
export function objectToKeyValueTransformer(obj: { [key: string]: any }): Partial<ProviderDatum<{ key: any, value: any}, any>>[] {
    return mapObjectToKeyValue(obj)
        .map((data) => ({
            data,
        }));
}

export default mapObjectToKeyValue;