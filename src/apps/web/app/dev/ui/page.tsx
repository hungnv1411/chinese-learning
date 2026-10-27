import { notFound } from 'next/navigation';

// Trang xem component của design system. Chỉ có ở dev (plan 00 §5 bước 1).
export const dynamic = 'force-dynamic';

const buttons = ['primary', 'secondary', 'blue', 'streak', 'danger', 'white', 'quiet'] as const;

export default function DevUi() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="main stack-6">
      <h1>/dev/ui</h1>

      <section className="stack-3">
        <h2>Button</h2>
        <div className="row wrap">
          {buttons.map((v) => (
            <button key={v} className={`btn btn-${v}`}>
              {v}
            </button>
          ))}
        </div>
        <div className="row wrap">
          {buttons.map((v) => (
            <button key={v} className={`btn btn-${v}`} disabled>
              {v} (disabled)
            </button>
          ))}
        </div>
        <button className="btn btn-primary btn-block">block</button>
      </section>

      <section className="stack-3">
        <h2>Badge · Progress</h2>
        <div className="row wrap">
          <span className="badge">mặc định</span>
          <span className="badge badge-success">✓ đúng</span>
          <span className="badge badge-danger">✗ sai</span>
          <span className="badge badge-blue">blue</span>
          <span className="badge badge-warn">warn</span>
          <span className="badge badge-streak">streak</span>
        </div>
        <div className="progress" style={{ ['--v' as string]: '60%' }}>
          <i />
        </div>
      </section>

      <section className="stack-3">
        <h2>Card · Field · Switch</h2>
        <div className="card">Card</div>
        <div className="field">
          <label htmlFor="f">Nhãn</label>
          <input id="f" placeholder="Gõ gì đó" />
        </div>
        <button className="switch" role="switch" aria-checked="true" aria-label="Bật" />
      </section>

      <section className="stack-3">
        <h2>Màu thanh điệu</h2>
        <p className="hz hz-lg">
          <span className="t1">妈</span>
          <span className="t2">麻</span>
          <span className="t3">马</span>
          <span className="t4">骂</span>
          <span className="t5">吗</span>
        </p>
      </section>
    </main>
  );
}
