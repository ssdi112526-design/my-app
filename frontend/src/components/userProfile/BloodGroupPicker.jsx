import { BLOOD_GROUPS } from "../../constants/userProfile";

export default function BloodGroupPicker({ value, onChange, required }) {
  return (
    <div className="blood-group-picker" role="group" aria-label="Blood group">
      <div className="blood-group-grid">
        {BLOOD_GROUPS.map((group) => {
          const selected = value === group;
          return (
            <button
              key={group}
              type="button"
              className={`blood-group-chip${selected ? " selected" : ""}`}
              onClick={() => onChange(group)}
              aria-pressed={selected}
            >
              {group}
            </button>
          );
        })}
      </div>
      {required && !value && (
        <p className="field-hint muted">Select a blood group to continue.</p>
      )}
    </div>
  );
}
