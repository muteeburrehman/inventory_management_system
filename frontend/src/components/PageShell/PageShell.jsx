import { Breadcrumb, Typography } from "antd";
import { Link } from "react-router-dom";

export function PageShell({ title, description, breadcrumb = [{ title: "Home", path: "/" }], children }) {
  const items = breadcrumb.map((b, i) => {
    const isLast = i === breadcrumb.length - 1;
    if (!isLast && b.path) {
      return { title: <Link to={b.path}>{b.title}</Link> };
    }
    return { title: b.title };
  });

  return (
    <div style={{ maxWidth: 1400 }}>
      <Breadcrumb style={{ marginBottom: 16 }} items={items} />
      <Typography.Title level={2} style={{ margin: "0 0 8px", fontWeight: 700, letterSpacing: "-0.02em" }}>
        {title}
      </Typography.Title>
      {description && (
        <Typography.Paragraph type="secondary" style={{ marginBottom: 24, maxWidth: 720 }}>
          {description}
        </Typography.Paragraph>
      )}
      {children}
    </div>
  );
}
