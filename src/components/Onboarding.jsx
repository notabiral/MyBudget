import { Logo } from "./ui.jsx";

export default function Onboarding({ onStartFresh, onStartDemo, onGoToData }) {
  return (
    <div className="onboarding">
      <a className="skip-link" href="#onboarding-actions">
        Skip to choices
      </a>
      <main className="wrap onboarding-inner">
        <p className="onboarding-wordmark">
          <Logo size={34} />
          <span translate="no">
            My<em>Budget</em>
          </span>
        </p>
        <h1 className="onboarding-title">
          Your money, <span className="accent">in plain sight.</span>
        </h1>
        <p className="onboarding-sub">
          Plan the month, track every pound, save with intent. No accounts, no
          server, no feed — just your budget, in this browser, and nowhere else.
        </p>
        <div className="onboarding-actions" id="onboarding-actions" tabIndex={-1}>
          <button
            type="button"
            className="button button-primary"
            onClick={onStartFresh}
            data-autofocus
            autoFocus
          >
            Start fresh
          </button>
          <button type="button" className="button button-outline" onClick={onStartDemo}>
            Explore with demo data
          </button>
        </div>
        <p className="onboarding-foot">
          Starting fresh gives you sensible default categories and an empty
          month. Demo data is clearly labelled and deletes in one tap. Have a
          backup or a CSV from the old app?{" "}
          <button
            type="button"
            className="onboarding-link"
            onClick={onGoToData}
          >
            Import it from the Data view
          </button>
          .
        </p>
      </main>
    </div>
  );
}
