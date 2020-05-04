import { BrowserWindow } from 'electron';

export interface ProviderFile {
    filepath: string;
    data: Buffer | string;
}

export abstract class Provider {
    /** The key under which all files will be stored. Should be filesystem-safe
     * (no spaces, all-lowercase) */
    public static key: string;
    /** Update the data that is retrieved by this Provider. Should return an
     * object with all new files, so they can be saved to disk. */
    abstract update(): Promise<ProviderFile[]>;
    /** Initialise the provider. This function is called only when it is
     * initialised for the first time during onboarding. The return boolean
     * indicates whether the provider succeeded in initialising, ie. by logging
     * into a particular service */
    abstract initialise(): Promise<boolean>;
}

export interface DataRequestProvider extends Provider {
    /** Dispatch a data request to this Provider. The difference between a
     * regular update and a data request, is that it is asynchronous, and might
     * take a couple hours or even days to complete. */
    dispatchDataRequest?(): Promise<void>;
    /** Check if the data request is already complete */
    isDataRequestComplete?(): Promise<boolean>;
    /** If the data request has been completed, download the resulting dump and
     * parse it, so that it can be processed and saved to the repository */
    parseDataRequest?(): Promise<ProviderFile[]>;
}

export abstract class DataRequestProvider extends Provider {
    /** The amount of days that are required between successive data requests */
    public static dataRequestIntervalDays: number;
}

export interface WithWindow {
    window: BrowserWindow;
    constructor: Function;
}

export interface DataRequestStatus {
    dispatched: Date;
    completed?: Date;
    lastCheck?: Date;
}

export enum ProviderCommands {
    UPDATE,
    UPDATE_ALL,
    DISPATCH_DATA_REQUEST,
    DISPATCH_DATA_REQUEST_TO_ALL,
    REFRESH,
    INITIALISE,
    GET_DISPATCHED_DATA_REQUESTS
}

export enum ProviderEvents {
    CHECKING_DATA_REQUESTS,
    DATA_REQUEST_COMPLETED,
    DATA_REQUEST_DISPATCHED,
}

export enum ProvidedDataTypes {
    // A email adress
    EMAIL = 'email',
    // A first name
    FIRST_NAME = 'first_name',
    // A last name
    LAST_NAME = 'last_name',
    // A full name, including first and last name
    FULL_NAME = 'full_name',
    // An IP address
    IP_ADDRESS = 'ip_address',
    // A user-agent that was saved as part as a log file
    USER_AGENT = 'user_agent',
    // A language that is used for browsing the platform
    USER_LANGUAGE = 'user_language',
    // A cookie that was saved
    COOKIE = 'cookie',
    // A follower for the user
    FOLLOWER = 'follower',
    // Another account that the user is following
    ACCOUNT_FOLLOWING = 'account_following',
    // Another account that the user has blocked
    BLOCKED_ACCOUNT = 'blocked_account',
    // A hashtag the user is following
    HASHTAG_FOLLOWING = 'hashtag_following',
    // An ad interest that was flagged by the system for the user
    AD_INTEREST = 'ad_interest',
    // A telephone number
    TELEPHONE_NUMBER = 'telephone_number',
    // A comment made by the user
    COMMENT = 'comment',
    // A device that was used by the user on the platform
    DEVICE = 'device',
    // A username that is used for a particular platform
    USERNAME = 'username',
    // A place (city, town, village, etc.) where the user resides
    PLACE_OF_RESIDENCE = 'place_of_residence',
    // A full adress, including street, number, ZIP-code and eventual state
    ADDRESS = 'address',
    // The country where a user resides
    COUNTRY = 'country',
    // A like thas been placed on a particular post
    LIKE = 'like',
    // A saved instance of the user logging in
    LOGIN_INSTANCE = 'login_instance',
    // A saved instance of the user logging out
    LOGOUT_INSTANCE = 'logout_instance',
    // A photo
    PHOTO = 'photo',
    // A message by the user, to another user
    MESSAGE = 'message',
    // A gender
    GENDER = 'gender',
    // A profile picture
    PROFILE_PICTURE = 'profile_picture',
    // A birth date
    DATE_OF_BIRTH = 'date_of_birth',
    // The date on which the user joined a platform
    JOIN_DATE = 'join_date',
    // A search query by the user
    SEARCH_QUERY = 'search_query',
    // A post that the user has seen
    POST_SEEN = 'post_seen',
    // A privacy setting for the user
    PRIVACY_SETTING = 'privacy_setting',
    // A telephone contact that has been uploaded by the user
    UPLOADED_CONTACT = 'uploaded_contact',
    // A saved cookie with possibly extra information
    SESSION = 'session',
}

export interface ProviderDatum<D, T = ProvidedDataTypes> {
    // The data format, as it is retrieved from a file
    data: D;
    // The type of this datum
    type: T;
    // The provider from which this data was gained
    provider: string;
    // The specific file from which the data was extracted
    source: string;
    // A timestamp that is associated with this specific datapoint. For
    // instance, when a post was posted.
    timestamp?: Date;
    // Wether this datum can be edited with the provider
    isEditable?: boolean;
    // Whether this datum can be deleted at the provider
    isDeletable?: boolean;
}

export type Email = ProviderDatum<string, ProvidedDataTypes.EMAIL>;
export type FirstName = ProviderDatum<string, ProvidedDataTypes.FIRST_NAME>;
export type LastName = ProviderDatum<string, ProvidedDataTypes.LAST_NAME>;
export type FullName = ProviderDatum<string, ProvidedDataTypes.FULL_NAME>;
export type IpAddress = ProviderDatum<string, ProvidedDataTypes.IP_ADDRESS>;
export type UserAgent = ProviderDatum<string, ProvidedDataTypes.USER_AGENT>;
export type UserLanguage = ProviderDatum<string, ProvidedDataTypes.USER_LANGUAGE>;
export type Follower = ProviderDatum<string, ProvidedDataTypes.FOLLOWER>;
export type AccountFollowing = ProviderDatum<string, ProvidedDataTypes.ACCOUNT_FOLLOWING>;
export type BlockedAccount = ProviderDatum<string, ProvidedDataTypes.BLOCKED_ACCOUNT>;
export type HashtagFollowing = ProviderDatum<string, ProvidedDataTypes.HASHTAG_FOLLOWING>;
export type AdInterest = ProviderDatum<string, ProvidedDataTypes.AD_INTEREST>;
export type TelephoneNumber = ProviderDatum<string, ProvidedDataTypes.TELEPHONE_NUMBER>;
export type Device = ProviderDatum<string, ProvidedDataTypes.DEVICE>;
export type Username = ProviderDatum<string, ProvidedDataTypes.USERNAME>;
export type PlaceOfResidence = ProviderDatum<string, ProvidedDataTypes.PLACE_OF_RESIDENCE>;
export type Address = ProviderDatum<{ street?: string; number?: number; state?: string; }, ProvidedDataTypes.ADDRESS>;
export type Country = ProviderDatum<string, ProvidedDataTypes.COUNTRY>;
export type Like = ProviderDatum<string, ProvidedDataTypes.LIKE>;
export type LoginInstance = ProviderDatum<number, ProvidedDataTypes.LOGIN_INSTANCE>;
export type LogOutInstance = ProviderDatum<unknown, ProvidedDataTypes.LOGOUT_INSTANCE>;
export type Photo = ProviderDatum<{ url: string, description: string }, ProvidedDataTypes.PHOTO>;
export type Message = ProviderDatum<string, ProvidedDataTypes.MESSAGE>;
export type Gender = ProviderDatum<string, ProvidedDataTypes.GENDER>;
export type ProfilePicture = ProviderDatum<string, ProvidedDataTypes.PROFILE_PICTURE>;
export type DateOfBirth = ProviderDatum<Date, ProvidedDataTypes.DATE_OF_BIRTH>;
export type JoinDate = ProviderDatum<Date, ProvidedDataTypes.JOIN_DATE>;
export type SearchQuery = ProviderDatum<string, ProvidedDataTypes.SEARCH_QUERY>;
export type PostSeen = ProviderDatum<string, ProvidedDataTypes.POST_SEEN>;
export type PrivacySetting = ProviderDatum<{ key: string; value: any }, ProvidedDataTypes.PRIVACY_SETTING>;
export type UploadedContact = ProviderDatum<unknown, ProvidedDataTypes.UPLOADED_CONTACT>;
type SessionData = {
    cookie_name: string;
    ip_address: string;
    language_code: string;
    timestamp: string;
    user_agent: string;
    device_id: string;
}
export type Session = ProviderDatum<SessionData, ProvidedDataTypes.SESSION>;

export interface ProviderParser {
    // The file from which the data has originated
    source: string;
    // An optional provider string
    provider?: string;
    // The schema for accessing the data in the particular file
    schemas: {
        // The key which is used to access the data. This key may be nested. If
        // the key is not set, the root object is assumed to be the key
        key?: string;
        // The type that is found at the particular key
        type: ProvidedDataTypes
        // An optional transformer that is used to translate complex objects
        // into the required shape
        transformer?(object: unknown): Partial<ProviderDatum<any, any>> | Partial<ProviderDatum<any, any>>[];
        // transformer?: (obj: any) => any | any[];
    }[]
}