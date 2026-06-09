import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { 
  PlayCircle, CheckCircle2, XCircle, AlertCircle, Clock, 
  FileText, ShieldCheck, ChevronDown, ChevronUp, Terminal
} from 'lucide-react';
import { toast } from 'sonner';

interface AssertionResult {
  title: string;
  fullName: string;
  status: 'passed' | 'failed';
  duration: number;
  ancestorTitles: string[];
}

interface TestResult {
  name: string;
  status: 'passed' | 'failed';
  message: string;
  startTime: number;
  endTime: number;
  assertionResults: AssertionResult[];
}

interface TestReport {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  startTime: number;
  success: boolean;
  testResults: TestResult[];
}

export default function TestDashboard() {
  const [report, setReport] = useState<TestReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [showRaw, setShowRaw] = useState(false);

  useEffect(() => {
    fetchTestReport();
  }, []);

  const fetchTestReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/test-report.json');
      if (!res.ok) {
        throw new Error('Test report file not found. Make sure "npm run build" has been run.');
      }
      const data = await res.json();
      setReport(data as TestReport);
      
      // Auto-expand all files initially
      const initialExpanded: Record<string, boolean> = {};
      data.testResults?.forEach((r: TestResult) => {
        initialExpanded[r.name] = true;
      });
      setExpandedFiles(initialExpanded);
    } catch (err: any) {
      console.error('Error fetching test report:', err);
      setError(err.message || 'Failed to load test report');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (fileName: string) => {
    setExpandedFiles(prev => ({ ...prev, [fileName]: !prev[fileName] }));
  };

  const getCleanFileName = (fullPath: string) => {
    const parts = fullPath.split('/src/');
    return parts.length > 1 ? `src/${parts[1]}` : fullPath.split('/').pop() || fullPath;
  };

  const formatDuration = (ms: number) => {
    if (ms < 1) return '< 1ms';
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-4">
        <PlayCircle className="h-12 w-12 animate-pulse text-indigo-500" />
        <p className="text-slate-500 font-medium animate-pulse">Loading System Diagnostics...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <Card className="border-0 shadow-md bg-white p-6 max-w-xl mx-auto text-center space-y-4">
        <AlertCircle className="h-14 w-14 mx-auto text-amber-500" />
        <CardTitle className="text-xl font-bold text-slate-800">No Test Report Found</CardTitle>
        <CardDescription className="text-slate-500">
          The automated test execution report could not be loaded. This typically happens before the initial project build or if the test suite failed to generate the report.
        </CardDescription>
        <div className="pt-2 flex justify-center gap-3">
          <Button onClick={fetchTestReport} variant="outline">Retry Loading</Button>
          <Button onClick={async () => {
            toast.loading('Running tests and rebuilding...');
            // In a mock demo environment we can show instructions
            toast.info('Run: npm run build to compile and generate report.');
          }} className="bg-primary text-white">Generate Report</Button>
        </div>
      </Card>
    );
  }

  // Calculate pass percentage
  const totalTests = report.numTotalTests;
  const passedTests = report.numPassedTests;
  const passRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;
  const totalDuration = report.testResults.reduce((acc, r) => {
    const fileDuration = r.assertionResults.reduce((sum, a) => sum + a.duration, 0);
    return acc + fileDuration;
  }, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-800">System Diagnostics</h1>
          <p className="text-sm text-slate-500 mt-1">Verified status of automated unit and integration tests executed at build time.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => setShowRaw(!showRaw)} className="border-slate-200">
            <Terminal className="h-4 w-4 mr-2" /> {showRaw ? 'Show Test UI' : 'Show Raw JSON'}
          </Button>
          <Button size="sm" onClick={fetchTestReport} className="bg-primary text-white">
            Refresh Status
          </Button>
        </div>
      </div>

      {showRaw ? (
        <Card className="border-0 shadow-md bg-slate-900 text-slate-200 font-mono p-4 overflow-auto max-h-[60vh] text-xs">
          <pre>{JSON.stringify(report, null, 2)}</pre>
        </Card>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Test Suite Status</p>
                  <div className="flex items-center gap-2 mt-2">
                    {report.success ? (
                      <>
                        <ShieldCheck className="h-6 w-6 text-green-500 shrink-0" />
                        <span className="text-xl font-bold text-slate-800">Healthy</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-6 w-6 text-red-500 shrink-0" />
                        <span className="text-xl font-bold text-slate-800">Failing</span>
                      </>
                    )}
                  </div>
                </div>
                <div className={`p-3.5 rounded-xl ${report.success ? 'bg-green-50' : 'bg-red-50'}`}>
                  {report.success ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : (
                    <XCircle className="h-6 w-6 text-red-600" />
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pass Rate</p>
                  <p className="text-2xl font-black text-slate-800 mt-2">
                    {passRate.toFixed(0)}% <span className="text-sm font-medium text-slate-400">({passedTests}/{totalTests})</span>
                  </p>
                </div>
                <div className="relative h-12 w-12 flex items-center justify-center shrink-0">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="24" cy="24" r="20" className="stroke-slate-100" strokeWidth="4" fill="transparent" />
                    <circle cx="24" cy="24" r="20" className="stroke-indigo-600" strokeWidth="4" fill="transparent"
                      strokeDasharray={`${2 * Math.PI * 20}`}
                      strokeDashoffset={`${2 * Math.PI * 20 * (1 - passRate / 100)}`}
                    />
                  </svg>
                  <span className="absolute text-[10px] font-bold text-indigo-700">{passRate.toFixed(0)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Test Files Passed</p>
                  <p className="text-2xl font-bold text-slate-800 mt-2">
                    {report.numPassedTestSuites} <span className="text-sm font-medium text-slate-400">of {report.numTotalTestSuites}</span>
                  </p>
                </div>
                <div className="p-3.5 bg-blue-50 rounded-xl">
                  <FileText className="h-6 w-6 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-md bg-white">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Duration</p>
                  <p className="text-2xl font-bold text-slate-800 mt-2">
                    {formatDuration(totalDuration)}
                  </p>
                </div>
                <div className="p-3.5 bg-amber-50 rounded-xl">
                  <Clock className="h-6 w-6 text-amber-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Test Suites List */}
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 px-1">
              <Terminal className="h-4.5 w-4.5 text-primary" />
              Detailed Test Results
            </h2>

            {report.testResults.map((suite) => {
              const cleanName = getCleanFileName(suite.name);
              const isExpanded = expandedFiles[suite.name];
              const passedCount = suite.assertionResults.filter(a => a.status === 'passed').length;
              const totalCount = suite.assertionResults.length;
              const suiteDuration = suite.assertionResults.reduce((sum, a) => sum + a.duration, 0);

              return (
                <Card key={suite.name} className="border-0 shadow-sm overflow-hidden bg-white">
                  {/* Suite Header */}
                  <div 
                    onClick={() => toggleExpand(suite.name)}
                    className="flex items-center justify-between p-4 bg-slate-50/50 hover:bg-slate-50 cursor-pointer border-b transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      {suite.status === 'passed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                      )}
                      <div>
                        <span className="font-bold text-sm text-slate-850">{cleanName}</span>
                        <span className="text-xs text-slate-400 ml-3 font-medium">({passedCount}/{totalCount} passed)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-xs font-mono font-medium text-slate-400 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(suiteDuration)}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </div>

                  {/* Assertion Results */}
                  {isExpanded && (
                    <CardContent className="p-0 divide-y">
                      {suite.assertionResults.map((assertion, idx) => (
                        <div key={idx} className="flex items-center justify-between p-4 pl-9 hover:bg-slate-50/30 transition-colors text-sm">
                          <div className="flex items-start gap-2.5">
                            {assertion.status === 'passed' ? (
                              <span className="h-2 w-2 rounded-full bg-green-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                            ) : (
                              <span className="h-2 w-2 rounded-full bg-red-500 mt-1.5 shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                            )}
                            <div>
                              <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                                {assertion.ancestorTitles.join(' › ')}
                              </p>
                              <p className="font-semibold text-slate-700 mt-0.5">{assertion.title}</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="font-mono text-[10px] border-slate-100 text-slate-500 bg-slate-50/30">
                            {formatDuration(assertion.duration)}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
