import path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';
import git, { TREE, Walker, StatusRow } from 'isomorphic-git';
import NodeGit from 'nodegit';
import { DiffResult, RepositoryEvents, Commit } from './types';
import CryptoFs from '../crypto-fs';
import nonCryptoFs from 'fs';
import diffMapFunction from './utilities/diff-map';
import generateParsedCommit from './utilities/generate-parsed-commit';
import { ProviderDatum } from 'main/providers/types';
import RepositoryBridge from './bridge';

// Define a location where the repository will be saved
// TODO: Encrypt this filesystem
export const APP_DATA_PATH = process.env.NODE_ENV === 'production' ? app.getPath('userData') : app.getAppPath();
export const REPOSITORY_PATH = path.resolve(APP_DATA_PATH, 'data', 'repository');
export const EMPTY_REPO_HASH = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';

const ENABLE_ENCRYPTION = process.env.ENABLE_ENCRYPTION !== 'false';
const fs = ENABLE_ENCRYPTION ? new CryptoFs('password').init() : nonCryptoFs;

class Repository extends EventEmitter {
    /**
     * The default config arguments for isomorphic-git
     */
    config = {
        fs: fs,
        dir: path.join(REPOSITORY_PATH, '.git'),
    }

    /**
     * Whether the git repository is ready for querying
     */
    isInitialised = false;

    /**
     * The default author for all commits made
     */
    author = NodeGit.Signature.now(
        'Aeon',
        'aeon@codified.nl',
    );

    /**
     * A reference to an instance of Nodegit's repository class
     */
    repository: NodeGit.Repository = null;
    index: NodeGit.Index = null;

    constructor() {
        super();

        NodeGit.Repository.open(this.config.dir)
            .catch(e => {
                return this.initialiseRepository();
            })
            .then(async (repository) => {
                this.repository = repository;
                this.index = await repository.refreshIndex();
                this.isInitialised= true;
                this.emit('ready');
                console.log('Repository was succesfully initiated at ', REPOSITORY_PATH);
            })
            .catch(console.error);
    }

    /**
     * Initialise a repository if one doesn't exist already. Also add a base
     * files and commit, so that we can work from there.
     */
    private async initialiseRepository(): Promise<NodeGit.Repository> {
        console.log('Repository was not found, creating a new one');

        // First we'll initiate the repository
        // await git.init(this.config)
        const repository = await NodeGit.Repository.init(this.config.dir, 0);

        // Then we'll write a file to disk so that the repository is populated
        const readmePath = 'README.md';
        await fs.promises.writeFile(path.resolve(REPOSITORY_PATH, readmePath), Buffer.from('# Aeon Repository', 'utf8'));

        // And create a first commit with the file
        // await git.add({ ...this.config, filepath: readmePath });
        // await git.commit({ ...this.config, author: this.author, message:
        // 'Initial commit' })
        const index = await repository.refreshIndex();
        await index.addByPath(readmePath);
        await index.write();
        const oid = await index.writeTree();
        await repository.createCommit('HEAD', this.author, this.author, 'Initial Commit', oid, []);
        
        console.log('Initiated new repository at ', REPOSITORY_PATH);

        // Then we return the commit log
        return repository;
    }

    /**
     * Generate a complete repository diff for two supplied trees
     * @param refTree The reference tree. Defaults to HEAD
     * @param comparedTree The tree the reference is compared to. Defaults to
     * the previous commit.
     */
    public async diff(
        ref: string = 'HEAD', 
        compared: string = null,
        options: { showUnchangedFiles?: boolean } = {}
    ): Promise<DiffResult<unknown>[]> {
        // Retrieve the commit based on either a supplied OID or otherwise HEAD
        const refCommit = ref === 'HEAD' 
            ? await this.repository.getHeadCommit()
            : await this.repository.getCommit(ref);
        // Then retrieve the tree for the the retrieved commit
        const refTree = await refCommit.getTree();

        // Then retrieve either a supplied commit or alternatively the parent
        // for the refCommit
        const comparedCommit = compared
            ? await this.repository.getCommit(compared)
            : await refCommit.parent(0).catch(() => {});
        // We then retrieve the tree for said commit
        const comparedTree = comparedCommit
            ? await comparedCommit.getTree()
            : await this.repository.getTree(EMPTY_REPO_HASH);

        // First off, we have to retrieve the diff object for the compared tree
        const diff = await refTree.diff(comparedTree);
        // Then, we'll retrieve the patch to signify the diff between the two
        const patches = await diff.patches();
        // Lastly, we'll map over all the individual patches (files) for this diff
        const diffs = (await Promise.all(
            patches.map(async (patch) => {
                // Retrieve the filepaths for both versions of the tree
                const oldFile = patch.oldFile().path();
                const newFile = patch.newFile().path();
                
                // Then retrieve the actual files
                const [oldEntry, newEntry] = await Promise.all([
                    await comparedTree.getEntry(oldFile).catch(e => undefined),
                    await refTree.getEntry(newFile).catch(e => undefined)
                ])

                return diffMapFunction(newFile, [newEntry, oldEntry]);
            })
        )).flat();

        // Optionally remove all files from the diff without changes
        if (!options.showUnchangedFiles) {
            // Loop through all files one-by-one
            return diffs.filter(file => file && file.hasChanges);
        }

        // Lastly, remove any of the diffs that are empty
        return diffs.filter(file => !!file);
    }

    /**
     * Save a file to disk
     * @param filepath The path to the file relative to the repository root
     * @param data The data that needs to be written to disk
     */
    public async save(filepath: string, data: string | Buffer): Promise<void> {
        const absolutePath = path.resolve(REPOSITORY_PATH, filepath);
        const dirPath = path.dirname(absolutePath);

        // Check if the directory already exists
        if (!fs.existsSync(dirPath)) {
            // If not, create the full path
            await fs.promises.mkdir(dirPath, { recursive: true });
        }

        // Write file to disk
        await fs.promises.writeFile(absolutePath, data);
    }

    /**
     * Generate a fully parsed tree
     */
    public async getParsedCommit(tree = TREE({ ref: 'HEAD' })): Promise<ProviderDatum<unknown, unknown>[]> {
        // const data = await git.walk({ 
        //     ...this.config,
        //     trees: [tree],
        //     map: generateParsedCommit,
        // }) as ProviderDatum<unknown, unknown>[][];

        // return data.flat().sort((a: ProviderDatum<unknown>, b: ProviderDatum<unknown>): number => {
        //     return a.type.localeCompare(b.type);
        // });
        return [];
    }

    /** 
     * Expose a number of Git functions directly
    */
    public async add(filepath: string): Promise<void> {
        await this.index.addByPath(filepath);
    }
    
    public async log(): Promise<Commit[]> {
        // Create new revwalk to gather all commits
        const walker = NodeGit.Revwalk.create(this.repository);

        // Start from HEAD and retrieve all commits
        walker.pushHead();
        const commits = await walker.getCommitsUntil(() => true) as NodeGit.Commit[];

        return Promise.all(
            commits.map(async (commit) => {
                const author = commit.author();

                return {
                    oid: commit.sha(),
                    message: commit.message(),
                    author: {
                        email: author.email(),
                        name: author.name(),
                        when: commit.time() * 1000,
                    },
                    parents: commit.parents().map(oid => oid.tostrS()),
                };
            })
        );
    }
    
    public async commit(message: string): Promise<void> {
        // Retrieve and write new index
        await this.index.write();
        const oid = await this.index.writeTree();

        // Retrieve the commit that is to serve as the parent commit
        const head = await NodeGit.Reference.nameToId(this.repository, 'HEAD');
        const parent = await this.repository.getCommit(head);

        // Create commit using new index
        const commit = await this.repository.createCommit('HEAD', this.author, this.author, message, oid, [parent]);

        // Refresh index, just in case
        this.index = await this.repository.refreshIndex();

        // Notify app of new commit
        RepositoryBridge.send(RepositoryEvents.NEW_COMMIT);
    }

    public status(args: { [key: string]: any } = {}): Promise<NodeGit.StatusFile[]> {
        return this.repository.getStatus();
    }
    
    public readFile = (filePath: string): Promise<Buffer> => fs.promises.readFile(filePath);
}

export default Repository;