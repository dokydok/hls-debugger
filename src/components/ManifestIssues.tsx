import type { ManifestIssue } from '../lib/types';

interface Props {
  issues: ManifestIssue[];
}

export function ManifestIssues({ issues }: Props) {
  if (issues.length === 0) return null;

  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const infos = issues.filter(i => i.severity === 'info');

  return (
    <div className="issue-list">
      {errors.map((issue, i) => (
        <div key={`e${i}`} className="issue-item issue-item--error">
          <span className="issue-item__icon">✗</span>
          <div className="issue-item__content">
            <span className="issue-item__message">{issue.message}</span>
            {issue.details && <span className="issue-item__details">{issue.details}</span>}
          </div>
        </div>
      ))}
      {warnings.map((issue, i) => (
        <div key={`w${i}`} className="issue-item issue-item--warning">
          <span className="issue-item__icon">⚠</span>
          <div className="issue-item__content">
            <span className="issue-item__message">{issue.message}</span>
            {issue.details && <span className="issue-item__details">{issue.details}</span>}
          </div>
        </div>
      ))}
      {infos.map((issue, i) => (
        <div key={`i${i}`} className="issue-item issue-item--info">
          <span className="issue-item__icon">ℹ</span>
          <div className="issue-item__content">
            <span className="issue-item__message">{issue.message}</span>
            {issue.details && <span className="issue-item__details">{issue.details}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
