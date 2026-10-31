import Button from "./ui/Button";
import Card from "./ui/Card";
import Steps from "./ui/Steps";

const STEPS = [
  { key: "lkp", title: "Place the LKP", description: "Click the map where the subject was last seen. Priors appear as a heatmap." },
  { key: "subject", title: "Describe the subject", description: "Paste the call-out; Claude pre-fills the subject card and you confirm every field." },
  { key: "reports", title: "Enter radio reports", description: "Claude proposes cells and POD; you review and edit, then apply." },
  { key: "decide", title: "Decide", description: "Suggestions rank cells by POA × expected POD. You assign teams, weigh clues and override with a reason." },
];

export default function WelcomeCard({ onDemo }: { onDemo: () => void }) {
  return (
    <Card title="Start a search" tone="primary">
      <Steps steps={STEPS} current={0} direction="vertical" />
      <div className="mt-4 flex items-center gap-3">
        <Button variant="primary" onClick={onDemo}>
          Load demo scenario
        </Button>
        <span className="text-xs text-fg-3">or click the map to place the LKP</span>
      </div>
    </Card>
  );
}
