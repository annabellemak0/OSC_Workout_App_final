// generated list of workouts based on relevance to user, muscle group or frequently used
import React, {useState, useEffect, useMemo} from 'react';

// --- Custom exercise storage (no backend, so we use the browser's localStorage) ---
const CUSTOM_KEY = 'customExercises';

const loadCustom = () => {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY)) || [];
  } catch {
    return [];
  }
};

const saveCustom = (list) => {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false; // storage full or blocked
  }
};

const EMPTY_FORM = {
  name: '',
  bodyPart: '',
  target: '',
  equipment: '',
  variantOf: '', // id of the exercise this one is closely related to ('' = none)
};

const WorkoutList = ({onSelectExercise, userFavorites = []}) => {
  const [exercises, setExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  //filter & Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState('all');
  const [viewTab, setViewTab] = useState('all'); // 'all', 'frequently_used', 'relevant'

  //track frequently used exercises locally or via props
  const [frequentlyUsedIds, setFrequentlyUsedIds] = useState(userFavorites);

  //create-your-own-exercise states
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState(null);

  useEffect(() => {
    const fetchExercises = async () => {

      try {
        setLoading(true);
        // ExerciseDB API via RapidAPI or local Kaggle dataset JSON
        const response = await fetch('https://exercisedb.p.rapidapi.com/exercises?limit=100', {
          method: 'GET',
          headers: {
            'X-RapidAPI-Key': process.env.REACT_APP_RAPIDAPI_KEY || '',
            'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        setExercises([...custom, ...data]);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchExercises();
  }, []);

  //Look up any exercise by id (used to show which exercise a custom one is a variant of)
  const exerciseById = useMemo(() => {
    return new Map(exercises.map((ex) => [String(ex.id), ex]));
  }, [exercises]);

  //Extract unique muscle groups/body parts dynamically
  const muscleGroups = useMemo(() => {
    const groups = new Set(exercises.map((ex) => ex.bodyPart).filter(Boolean));
    return ['all', ...Array.from(groups)];
  }, [exercises]);

  //filter logic based on search, selected muscle group, and view tab
  const filteredExercises = useMemo(() => {
    return exercises.filter((exercise) => {
      //1. Frequently Used filter
      if (viewTab === 'frequently_used' && !frequentlyUsedIds.includes(exercise.id)) {
        return false;
      }

      //2. Muscle Group filter
      const matchesMuscle =
        selectedMuscle === 'all' ||
        exercise.bodyPart?.toLowerCase() === selectedMuscle.toLowerCase();

      //3. Search query filter
      const matchesSearch = exercise.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase());

      return matchesMuscle && matchesSearch;
    });
  }, [exercises, viewTab, selectedMuscle, searchTerm, frequentlyUsedIds]);

  const handleSelect = (exercise) => {
    //dynamically add to frequently used list when selected
    if (!frequentlyUsedIds.includes(exercise.id)) {
      setFrequentlyUsedIds((prev) => [...prev, exercise.id]);
    }
    if (onSelectExercise) {
      onSelectExercise(exercise);
    }
  };

  //update a single form field without losing the others
  const updateField = (field, value) => {
    setForm((prev) => ({...prev, [field]: value}));
  };

  //when a related exercise is picked, pre-fill any empty fields from it
  const handleVariantChange = (parentId) => {
    const parent = exerciseById.get(parentId);
    setForm((prev) => ({
      ...prev,
      variantOf: parentId,
      bodyPart: prev.bodyPart || parent?.bodyPart || '',
      target: prev.target || parent?.target || '',
      equipment: prev.equipment || parent?.equipment || '',
    }));
  };

  const handleCreate = (e) => {
    e.preventDefault(); // stop the browser from reloading the page

    const name = form.name.trim();
    if (!name) {
      setFormError('Enter a name for your exercise.');
      return;
    }

    const newExercise = {
      id: `custom-${Date.now()}`, // prefix keeps it from clashing with API ids
      name,
      bodyPart: form.bodyPart.trim().toLowerCase(), // lowercase matches the API's values
      target: form.target.trim().toLowerCase(),
      equipment: form.equipment.trim().toLowerCase(),
      variantOf: form.variantOf || null,
      isCustom: true,
    };

    const saved = saveCustom([...loadCustom(), newExercise]);
    if (!saved) {
      setFormError('Could not save your exercise. Browser storage may be full or blocked.');
      return;
    }

    setExercises((prev) => [newExercise, ...prev]);
    setForm(EMPTY_FORM);
    setFormError(null);
    setShowForm(false);
  };

  if (loading) return <div className="loading-spinner">Loading exercise library...</div>;

  if (error) return <div className="error-message">Error fetching exercises: {error}</div>;

  return (
    <div className="workout-list-container">
      <h2>Workout Exercises</h2>
      

      {/* View Tabs: All, Frequently Used */}
      <div className="tab-navigation">
        <button
          className={viewTab === 'all' ? 'tab active' : 'tab'}
          onClick={() => setViewTab('all')}
        >
          All Exercises
        </button>
        <button
          className={viewTab === 'frequently_used' ? 'tab active' : 'tab'}
          onClick={() => setViewTab('frequently_used')}
        >
          Frequently Used ({frequentlyUsedIds.length})
        </button>
      </div>

      {/* Create your own exercise */}
      <div className="create-exercise">
        <button
          type="button"
          className="create-toggle-button"
          onClick={() => setShowForm((open) => !open)}
        >
          {showForm ? 'Cancel' : 'Create your own exercise'}
        </button>

        {showForm && (
          <form className="create-exercise-form" onSubmit={handleCreate}>
            <label>
              Name
              <input
                type="text"
                value={form.name}
                onChange={(e) => updateField('name', e.target.value)}
                required
              />
            </label>

            <label>
              Closely related to
              <select
                value={form.variantOf}
                onChange={(e) => handleVariantChange(e.target.value)}
              >
                <option value="">Not a variant of anything</option>
                {exercises.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Body part
              <input
                type="text"
                value={form.bodyPart}
                onChange={(e) => updateField('bodyPart', e.target.value)}
              />
            </label>

            <label>
              Target muscle
              <input
                type="text"
                value={form.target}
                onChange={(e) => updateField('target', e.target.value)}
              />
            </label>

            <label>
              Equipment
              <input
                type="text"
                value={form.equipment}
                onChange={(e) => updateField('equipment', e.target.value)}
              />
            </label>

            {formError && <p className="form-error">{formError}</p>}

            <button type="submit" className="save-exercise-button">
              Save exercise
            </button>
          </form>
        )}
      </div>

      {/* Filter and Search Controls */}
      <div className="filter-controls">
        <input
          type="text"
          placeholder="Search workouts by name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-bar"
        />
        <select
          value={selectedMuscle}
          onChange={(e) => setSelectedMuscle(e.target.value)}
          className="muscle-dropdown"
        >
          <option value="all">Filter by Muscle Group</option>
          {muscleGroups
            .filter((m) => m !== 'all')
            .map((muscle) => (
              <option key={muscle} value={muscle}>
                {muscle.charAt(0).toUpperCase() + muscle.slice(1)}
              </option>
            ))}
        </select>
      </div>

      {/*Exercise Grid Display */}
      <div className="exercise-grid">
        {filteredExercises.length === 0 ? (
          <p className="no-results">No exercises match your selection.</p>
        ) : (
          filteredExercises.map((exercise) => {
            const parent = exercise.variantOf
              ? exerciseById.get(String(exercise.variantOf))
              : null;

            return (
              <div key={exercise.id} className="exercise-card">
                {exercise.gifUrl && (
                  <img
                    src={exercise.gifUrl}
                    alt={exercise.name}
                    loading="lazy"
                    className="exercise-image"
                  />
                )}
                <h3 className="exercise-title">{exercise.name}</h3>
                <div className="exercise-meta">
                  {exercise.bodyPart && <span className="badge muscle">{exercise.bodyPart}</span>}
                  {exercise.target && <span className="badge target">{exercise.target}</span>}
                  {exercise.equipment && <span className="badge equipment">{exercise.equipment}</span>}
                  {exercise.isCustom && <span className="badge custom">Custom</span>}
                </div>

                {parent && (
                  <p className="variant-note">Variant of {parent.name}</p>
                )}

                <button
                  onClick={() => handleSelect(exercise)}
                  className="select-button"
                >
                  Add to Routine
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default WorkoutList;
