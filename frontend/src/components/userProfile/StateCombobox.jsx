import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiMapPin } from "react-icons/fi";
import { INDIAN_STATES } from "../../constants/userProfile";

export default function StateCombobox({ value, onChange, required, id = "state" }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value || "");
  const rootRef = useRef(null);

  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return INDIAN_STATES;
    return INDIAN_STATES.filter((s) => s.toLowerCase().includes(q));
  }, [query]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const pick = (state) => {
    onChange(state);
    setQuery(state);
    setOpen(false);
  };

  return (
    <div
      ref={rootRef}
      className={`state-combobox${open ? " open" : ""}`}
    >
      <div className="state-combobox-input-wrap">
        <FiMapPin className="state-combobox-icon" aria-hidden />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Search or select state"
          value={query}
          required={required}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange("");
          }}
          onFocus={() => setOpen(true)}
        />
        <button
          type="button"
          className="state-combobox-toggle"
          aria-label="Toggle state list"
          onClick={() => setOpen((v) => !v)}
        >
          <FiChevronDown aria-hidden />
        </button>
      </div>

      {open && (
        <ul className="state-combobox-list" role="listbox">
          {filtered.length === 0 ? (
            <li className="state-combobox-empty">No matching state</li>
          ) : (
            filtered.map((state) => (
              <li key={state}>
                <button
                  type="button"
                  role="option"
                  aria-selected={value === state}
                  className={value === state ? "selected" : ""}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(state)}
                >
                  {state}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
