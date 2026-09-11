<?php

namespace App\Policies;

use App\Enums\UserRole;
use App\Models\Incident;
use App\Models\User;

/**
 * Смотрит инцидент любой авторизованный (включая viewer). Правит и удаляет —
 * администратор, либо автор записи, либо дежурный, вписанный именно в этот
 * инцидент; viewer не создаёт и не правит ничего.
 */
class IncidentPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Incident $incident): bool
    {
        return true;
    }

    public function create(User $user): bool
    {
        return $user->role !== UserRole::Viewer;
    }

    public function update(User $user, Incident $incident): bool
    {
        return $user->isAdmin()
            || $user->id === $incident->created_by
            || $user->id === $incident->on_duty_user_id;
    }

    public function delete(User $user, Incident $incident): bool
    {
        return $this->update($user, $incident);
    }
}
