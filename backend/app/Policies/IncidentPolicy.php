<?php

namespace App\Policies;

use App\Models\Incident;
use App\Models\User;

/**
 * Правит инцидент либо администратор (любой), либо дежурный, вписанный
 * в этот конкретный инцидент — не любой дежурный вообще.
 */
class IncidentPolicy
{
    public function update(User $user, Incident $incident): bool
    {
        return $user->isAdmin() || $user->id === $incident->on_duty_user_id;
    }

    public function delete(User $user, Incident $incident): bool
    {
        return $this->update($user, $incident);
    }
}
