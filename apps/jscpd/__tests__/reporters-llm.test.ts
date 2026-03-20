import {describe, it, afterEach, beforeEach, expect, vi} from "vitest";
import {jscpd} from '../src';
import {join} from 'path'
import {LlmReporter} from '@jscpd/finder';
import {IClone, IStatistic, getDefaultOptions} from '@jscpd/core';
import {readJSONSync} from 'fs-extra';
import {initCli} from '../src/init';

const pathToFixtures = join(__dirname, '/../../../fixtures');
const packageJson = readJSONSync(join(__dirname, '/../package.json'));

describe('jscpd llm reporter', () => {

	let _log: typeof console.log;
	let _error: typeof console.error;

	beforeEach(() => {
		_log = console.log;
		_error = console.error;
		console.log = vi.fn();
		console.error = vi.fn();
	})

	afterEach(() => {
		console.log = _log;
		console.error = _error;
	})

	describe('integration', () => {

		it('should output header with clone count and duplication stats', async () => {
			const log = console.log as ReturnType<typeof vi.fn>;
			await jscpd(['', '', pathToFixtures + '/clike/file2.c', '--reporters', 'llm']);
			expect(log).toHaveBeenCalledWith(expect.stringContaining('Copy Detection: 1 clones'));
		});

		it('should include Lines (l) and Tokens (t) legend in header', async () => {
			const log = console.log as ReturnType<typeof vi.fn>;
			await jscpd(['', '', pathToFixtures + '/clike/file2.c', '--reporters', 'llm']);
			expect(log).toHaveBeenCalledWith(expect.stringContaining('Lines (l)'));
			expect(log).toHaveBeenCalledWith(expect.stringContaining('Tokens (t)'));
		});

		it('should include clone entry with location and size tag', async () => {
			const log = console.log as ReturnType<typeof vi.fn>;
			await jscpd(['', '', pathToFixtures + '/clike/file2.c', '--reporters', 'llm']);
			const output = log.mock.calls.map((c: unknown[]) => c[0]).join('\n');
			expect(output).toMatch(/file2\.c .* ↔ .* \d+l\/\d+t/);
		});

		it('should suppress console progress output (auto-silent)', async () => {
			const log = console.log as ReturnType<typeof vi.fn>;
			await jscpd(['', '', pathToFixtures + '/clike/file2.c', '--reporters', 'llm']);
			const output = log.mock.calls.map((c: unknown[]) => c[0]).join('\n');
			expect(output).not.toContain('Clone found');
			expect(output).not.toContain('Detection time');
		});

		it('should preserve explicit console reporters while suppressing progress output', async () => {
			const log = console.log as ReturnType<typeof vi.fn>;
			await jscpd(['', '', pathToFixtures + '/clike/file2.c', '--reporters', 'llm,console']);
			const output = log.mock.calls.map((c: unknown[]) => c[0]).join('\n');
			expect(output).toContain('Copy Detection: 1 clones');
			expect(output).toContain('Format');
			expect(output).toContain('Found 1 clones.');
			expect(output).not.toContain('Clone found');
			expect(output).not.toContain('Detection time');
		});
	});

	describe('budget', () => {

		const makeClone = (startLine: number, endLine: number, path = '/src/a.ts'): IClone => ({
			format: 'typescript',
			duplicationA: {
				sourceId: path,
				start: {line: startLine, column: 0},
				end: {line: endLine, column: 0},
				range: [0, 100] as [number, number],
			},
			duplicationB: {
				sourceId: path,
				start: {line: startLine + 50, column: 0},
				end: {line: endLine + 50, column: 0},
				range: [200, 300] as [number, number],
			},
		});

		const statistic: IStatistic = {
			detectionDate: new Date().toISOString(),
			formats: {},
			total: {
				lines: 1000, tokens: 5000, sources: 10, clones: 5,
				duplicatedLines: 200, duplicatedTokens: 1000,
				percentage: 20, percentageTokens: 20,
				newDuplicatedLines: 0, newClones: 0,
			},
		};

		it('should truncate when maxLines is exceeded and show omitted summary', () => {
			const log = console.log as ReturnType<typeof vi.fn>;
			const clones = Array.from({length: 10}, (_, i) => makeClone(i * 20, i * 20 + 15));
			const options = {...getDefaultOptions(), reportersOptions: {llm: {maxLines: 5}}};
			const reporter = new LlmReporter(options);

			reporter.report(clones, statistic);

			const output = (log.mock.calls[0][0] as string);
			expect(output).toContain('... and 5 more clones');
		});

		it('should sort clones largest first', () => {
			const log = console.log as ReturnType<typeof vi.fn>;
			const small = makeClone(1, 5, '/src/small.ts');
			const large = makeClone(1, 50, '/src/large.ts');
			const options = getDefaultOptions();
			const reporter = new LlmReporter(options);

			reporter.report([small, large], statistic);

			const output = (log.mock.calls[0][0] as string);
			expect(output.indexOf('large.ts')).toBeLessThan(output.indexOf('small.ts'));
		});
	});

	describe('help', () => {
		it('should keep the generic reporters help text from master', () => {
			const cli = initCli(packageJson, ['', '', pathToFixtures]);
			const help = cli.helpInformation().replace(/\s+/g, ' ');
			expect(help).toContain('reporters or list of reporters separated with comma to use (Default is time,console)');
		});
	});
});
