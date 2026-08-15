"use client";

import SearchIcon from "@mui/icons-material/Search";
import InputAdornment from "@mui/material/InputAdornment";
import Paper from "@mui/material/Paper";
import TextField from "@mui/material/TextField";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** Debounced search box. Writes the term to ?q= so the server component re-queries. */
export function PatientSearch({ defaultValue }: { defaultValue: string }) {
  const [term, setTerm] = useState(defaultValue);
  const router = useRouter();

  useEffect(() => {
    if (term === defaultValue) return;

    const timer = setTimeout(() => {
      router.replace(term ? `/patients?q=${encodeURIComponent(term)}` : "/patients");
    }, 300);

    return () => clearTimeout(timer);
  }, [term, defaultValue, router]);

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <TextField
        value={term}
        onChange={(event) => setTerm(event.target.value)}
        label="Search patients"
        placeholder="Name, patient number or phone"
        fullWidth
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
      />
    </Paper>
  );
}
